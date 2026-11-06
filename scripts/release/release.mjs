#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { packageByName, packages, RELEASE_MARKER } from "./config.mjs"
import {
  cascadePackages,
  changedFiles,
  compareVersions,
  directPackagesForFiles,
  gitOutput,
  isReleaseCommit,
  packageVersion,
  patchVersion,
} from "./release-lib.mjs"

const root = path.resolve(import.meta.dirname, "../..")
const args = Object.fromEntries(
  process.argv.slice(3).map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=")
    return [key, rest.join("=") || true]
  }),
)
const command = process.argv[2] ?? "plan"

const run = (file, fileArgs, options = {}) =>
  execFileSync(file, fileArgs, { cwd: root, stdio: "inherit", ...options })
const parseNames = (input) =>
  String(input ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

function assertAllowed(names) {
  for (const name of names) {
    if (!packageByName.has(name)) throw new Error(`Not publishable: ${name}`)
  }
}

async function registryVersion(name) {
  try {
    return execFileSync("npm", ["view", name, "version", "--json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .trim()
      .replaceAll('"', "")
  } catch (error) {
    const details = `${error.stderr ?? ""}${error.message ?? ""}`
    if (details.includes("E404")) return null
    throw error
  }
}

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

async function registryLatest(name) {
  try {
    return execFileSync("npm", ["view", name, "dist-tags.latest", "--json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .trim()
      .replaceAll('"', "")
  } catch (error) {
    const details = `${error.stderr ?? ""}${error.message ?? ""}`
    if (details.includes("E404")) return null
    throw error
  }
}

async function verifyRegistryVersion(name, version) {
  // npm metadata can lag behind a successful publish. Require both the immutable
  // version and the mutable `latest` tag before downstream automation may proceed.
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    if (
      (await registryVersion(`${name}@${version}`)) === version &&
      (await registryLatest(name)) === version
    ) {
      return
    }
    if (attempt < 6) await wait(2_000)
  }
  throw new Error(`Registry verification failed for ${name}@${version}`)
}

async function plan() {
  const head = String(args.head || "HEAD")
  const subject = gitOutput(["show", "-s", "--format=%s", head], root)
  // The workflow pushes authoritative versions back to main; treating that bot
  // commit as a no-op prevents an infinite patch-release loop.
  if (isReleaseCommit(subject))
    return { direct: [], packages: [], files: [], versions: {} }
  const files = changedFiles(root, String(args.base || `${head}^`), head)
  const direct = directPackagesForFiles(files)
  const selected = cascadePackages(direct)
  const versions = {}
  for (const name of selected) {
    let candidate = patchVersion(packageVersion(root, name))
    if (args.registry) {
      // Registry state wins over a stale manifest, and published versions are
      // skipped because npm versions are immutable.
      const latest = await registryLatest(name)
      if (latest && compareVersions(candidate, latest) <= 0) {
        candidate = patchVersion(latest)
      }
      while ((await registryVersion(`${name}@${candidate}`)) === candidate) {
        candidate = patchVersion(candidate)
      }
    }
    versions[name] = candidate
  }
  return { direct, packages: selected, files, versions }
}

function writePlan(result) {
  // Committing these versions and the regenerated lockfile makes Git, rather
  // than ephemeral workflow state, authoritative for recovery operations.
  for (const name of result.packages) {
    const { dir } = packageByName.get(name)
    const manifestPath = path.join(root, dir, "package.json")
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    manifest.version = result.versions[name]
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

function writeOutput(result) {
  const json = JSON.stringify(result)
  console.log(json)
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `plan=${json}\npackages=${result.packages.join(",")}\n`,
      {
        flag: "a",
      },
    )
  }
}

function pack(names) {
  assertAllowed(names)
  const out = path.join(root, ".release", "packs")
  mkdirSync(out, { recursive: true })
  for (const name of names) {
    const version = packageVersion(root, name)
    const filename = `${name.replace("@goodsdks/", "")}-${version}.tgz`
    run("yarn", ["workspace", name, "pack", "--out", path.join(out, filename)])
    const listing = execFileSync("tar", ["-tzf", path.join(out, filename)], {
      encoding: "utf8",
    })
    // Validate the actual publication artifact, not only the workspace build.
    if (
      !listing.includes("package/package.json") ||
      !listing.includes("package/dist/")
    ) {
      throw new Error(`${filename} is missing package.json or dist output`)
    }
  }
}

function verify(names) {
  assertAllowed(names)
  for (const name of names) {
    run("yarn", ["workspace", name, "build"], {
      env: { ...process.env, CI: "true" },
    })
    const { dir } = packageByName.get(name)
    const manifest = JSON.parse(
      readFileSync(path.join(root, dir, "package.json"), "utf8"),
    )
    if (manifest.scripts?.lint) {
      run("yarn", ["workspace", name, "lint"], {
        env: { ...process.env, CI: "true" },
      })
    }
    if (manifest.scripts?.test) {
      run("yarn", ["workspace", name, "test"], {
        env: { ...process.env, CI: "true" },
      })
    }
  }
}

function tag(names) {
  assertAllowed(names)
  for (const name of names) {
    const version = packageVersion(root, name)
    const tagName = `${name.replace("@goodsdks/", "")}-v${version}`
    run("git", ["tag", "-a", tagName, "-m", `${name}@${version}`])
  }
}

async function publish(names) {
  assertAllowed(names)
  for (const name of names) {
    const version = packageVersion(root, name)
    const published = await registryVersion(`${name}@${version}`)
    if (published === version) {
      // Recovery is idempotent: repair `latest` when needed instead of attempting
      // to republish an immutable version.
      if ((await registryLatest(name)) !== version) {
        run("npm", ["dist-tag", "add", `${name}@${version}`, "latest"])
      }
      await verifyRegistryVersion(name, version)
      console.log(`${name}@${version} already exists; latest verified`)
      continue
    }
    const filename = path.join(
      root,
      ".release",
      "packs",
      `${name.replace("@goodsdks/", "")}-${version}.tgz`,
    )
    run("npm", ["publish", filename, "--access", "public", "--provenance"])
    await verifyRegistryVersion(name, version)
  }
}

if (command === "plan" || command === "prepare") {
  const result = await plan()
  if (command === "prepare" && result.packages.length) writePlan(result)
  writeOutput(result)
} else if (command === "pack") {
  pack(parseNames(args.packages))
} else if (command === "verify") {
  verify(parseNames(args.packages))
} else if (command === "tag") {
  tag(parseNames(args.packages))
} else if (command === "assert-bootstrap") {
  // These pre-existing versions establish registry history before automatic
  // patching is allowed to begin.
  const expected = {
    "@goodsdks/bridging-sdk": "1.0.5",
    "@goodsdks/engagement-sdk": "1.0.5",
  }
  for (const [name, version] of Object.entries(expected)) {
    if (packageVersion(root, name) !== version) {
      throw new Error(`Bootstrap requires ${name}@${version} to be committed`)
    }
  }
} else if (command === "check-bootstrap") {
  // Fail closed on normal pushes until the one-time manual bootstrap has put
  // both committed versions under npm's `latest` tag.
  const expected = {
    "@goodsdks/bridging-sdk": "1.0.5",
    "@goodsdks/engagement-sdk": "1.0.5",
  }
  for (const [name, version] of Object.entries(expected)) {
    if (
      (await registryVersion(`${name}@${version}`)) !== version ||
      (await registryLatest(name)) !== version
    ) {
      throw new Error(
        `${name}@${version} must be bootstrapped under latest with the manual workflow before automatic releases`,
      )
    }
  }
} else if (command === "publish" || command === "recover") {
  await publish(parseNames(args.packages))
} else if (command === "bootstrap") {
  const names = ["@goodsdks/bridging-sdk", "@goodsdks/engagement-sdk"]
  pack(names)
  await publish(names)
} else {
  throw new Error(`Unknown release command: ${command}`)
}

export { RELEASE_MARKER }
