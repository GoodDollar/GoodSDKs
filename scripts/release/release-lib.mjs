import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  consumers,
  packageByName,
  packages,
  RELEASE_MARKER,
} from "./config.mjs"

// This script is mainly to fuel the tests and does not include any actual execution of the release process.

const rootResolutionFiles = new Set([
  ".yarnrc.yml",
  "package.json",
  "tsconfig.json",
  "turbo.json",
  "yarn.lock",
])

export function isReleaseRelevant(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/")
  if (rootResolutionFiles.has(normalized)) return true
  const pkg = packages.find(({ dir }) => normalized.startsWith(`${dir}/`))
  if (!pkg) return false
  const local = normalized.slice(pkg.dir.length + 1)
  if (
    /(^|\/)(__tests__|test|tests|docs?)\//.test(local) ||
    /(^|\/)(readme|changelog)(\.[^/]*)?$/i.test(local) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(local) ||
    /\.(md|mdx)$/.test(local)
  ) {
    return false
  }
  return (
    local === "package.json" ||
    local === "tsconfig.json" ||
    local.startsWith("src/") ||
    local.startsWith("iife/") ||
    /^(tsup|vite|rollup|webpack)\.config\.[cm]?[jt]s$/.test(local)
  )
}

export function directPackagesForFiles(files) {
  // Root resolution changes can alter every packed dependency graph even when no
  // package source changed, so conservatively release the entire public surface.
  if (
    files.some((file) => rootResolutionFiles.has(file.replaceAll("\\", "/")))
  ) {
    return packages.map(({ name }) => name)
  }
  return packages
    .filter(({ dir }) =>
      files.some(
        (file) => file.startsWith(`${dir}/`) && isReleaseRelevant(file),
      ),
    )
    .map(({ name }) => name)
}

export function cascadePackages(direct) {
  const selected = new Set(direct)
  const queue = [...direct]
  while (queue.length) {
    for (const consumer of consumers[queue.shift()] ?? []) {
      if (!selected.has(consumer)) {
        selected.add(consumer)
        queue.push(consumer)
      }
    }
  }
  // Config order is topological: dependencies precede their consumers.
  return packages.map(({ name }) => name).filter((name) => selected.has(name))
}

export function patchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`Expected a stable semver, received ${version}`)
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

export function compareVersions(left, right) {
  const parse = (version) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
    if (!match) throw new Error(`Expected a stable semver, received ${version}`)
    return match.slice(1).map(Number)
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

export function packageVersion(root, name) {
  const pkg = packageByName.get(name)
  if (!pkg) throw new Error(`Package is not on the release allowlist: ${name}`)
  return JSON.parse(
    readFileSync(path.join(root, pkg.dir, "package.json"), "utf8"),
  ).version
}

export function isReleaseCommit(subject) {
  return subject.startsWith(RELEASE_MARKER)
}

export function gitOutput(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

export function changedFiles(root, base, head) {
  // A branch-creation push has an all-zero base and no meaningful comparison.
  if (!base || /^0+$/.test(base)) return []
  const output = gitOutput(["diff", "--name-only", `${base}..${head}`], root)
  return output ? output.split("\n") : []
}
