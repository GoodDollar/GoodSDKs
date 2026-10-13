#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { packageByName, packages } from "./config.mjs"

const root = path.resolve(import.meta.dirname, "../..")
// Enforce publication invariants centrally so an accidentally private,
// source-heavy, or incompletely exported package cannot reach npm.
for (const expected of packages) {
  const manifest = JSON.parse(readFileSync(path.join(root, expected.dir, "package.json"), "utf8"))
  assert.equal(manifest.name, expected.name)
  assert.notEqual(manifest.private, true, `${manifest.name} must remain public`)
  // Package metadata must agree with the repository's actual root license.
  // This prevents npm from advertising terms that contradict the source tree.
  assert.equal(manifest.license, "MIT", `${manifest.name} needs the MIT license`)
  assert.equal(manifest.publishConfig?.access, "public", `${manifest.name} needs public access`)
  assert.equal(
    manifest.repository?.url,
    "git+https://github.com/GoodDollar/GoodSDKs.git",
    `${manifest.name} needs its repository`,
  )
  assert.equal(manifest.repository?.directory, expected.dir)
  assert.deepEqual(manifest.files, ["dist"], `${manifest.name} should ship build output only`)
  assert.ok(manifest.main, `${manifest.name} needs a main entry`)
  assert.ok(manifest.module, `${manifest.name} needs an ESM entry`)
  assert.ok(manifest.types, `${manifest.name} needs a types entry`)
  assert.ok(manifest.exports, `${manifest.name} needs explicit exports`)
  assert.doesNotMatch(JSON.stringify(manifest.exports), /index\.cts/, `${manifest.name} has invalid CJS types`)
  for (const group of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const [name, range] of Object.entries(manifest[group] ?? {})) {
      if (packageByName.has(name) && group !== "peerDependencies") {
        assert.match(range, /^workspace:\^$/, `${manifest.name} has an unpinned workspace range`)
      }
    }
  }
}
console.log(`Validated ${packages.length} publishable package manifests`)
