import assert from "node:assert/strict"
import test from "node:test"
import {
  cascadePackages,
  compareVersions,
  directPackagesForFiles,
  isReleaseCommit,
  patchVersion,
} from "./release-lib.mjs"

test("citizen changes cascade to both published consumers", () => {
  assert.deepEqual(cascadePackages(["@goodsdks/citizen-sdk"]), [
    "@goodsdks/citizen-sdk",
    "@goodsdks/react-hooks",
    "@goodsdks/ui-components",
  ])
})

test("savings SDK changes cascade to the widget", () => {
  assert.deepEqual(cascadePackages(["@goodsdks/savings-sdk"]), [
    "@goodsdks/savings-sdk",
    "@goodsdks/savings-widget",
  ])
})

test("engagement remains isolated", () => {
  assert.deepEqual(cascadePackages(["@goodsdks/engagement-sdk"]), [
    "@goodsdks/engagement-sdk",
  ])
})

test("docs and tests do not trigger releases", () => {
  assert.deepEqual(
    directPackagesForFiles([
      "packages/citizen-sdk/README.md",
      "packages/citizen-sdk/test/wallet-link.test.ts",
      "packages/citizen-sdk/src/auth.test.ts",
    ]),
    [],
  )
})

test("public source, build config and manifest changes trigger releases", () => {
  assert.deepEqual(
    directPackagesForFiles([
      "packages/bridging-sdk/src/index.ts",
      "packages/invite-sdk/tsup.config.ts",
      "packages/engagement-sdk/package.json",
    ]),
    [
      "@goodsdks/bridging-sdk",
      "@goodsdks/engagement-sdk",
      "@goodsdks/invite-sdk",
    ],
  )
})

test("root resolution changes release the full allowlist", () => {
  assert.equal(directPackagesForFiles(["yarn.lock"]).length, 10)
})

test("release marker prevents a release loop", () => {
  assert.equal(isReleaseCommit("chore(release): publish citizen-sdk [skip release]"), true)
  assert.equal(isReleaseCommit("fix: citizen"), false)
})

test("only stable versions receive patch bumps", () => {
  assert.equal(patchVersion("1.0.5"), "1.0.6")
  assert.ok(compareVersions("1.0.10", "1.0.9") > 0)
  assert.throws(() => patchVersion("1.0.5-beta.1"))
})
