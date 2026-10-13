#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const buildDirectory = path.resolve(process.argv[2] ?? "")
if (!process.argv[2] || !statSync(buildDirectory).isDirectory()) {
  throw new Error("Usage: scan-build-secrets.mjs <build-directory>")
}

const secretName = /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|AUTH)(?:_|$)/i
// VITE_* values are intentionally public browser configuration. Everything else
// matching common CI, npm, Vercel, or secret names must remain absent from output.
const candidates = Object.entries(process.env).filter(
  ([name, value]) =>
    value &&
    value.length >= 8 &&
    !name.startsWith("VITE_") &&
    (secretName.test(name) || /^(?:NPM|VERCEL|CI)_/.test(name)),
)

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? files(target) : [target]
  })
}

const leaks = []
for (const filename of files(buildDirectory)) {
  const content = readFileSync(filename)
  for (const [name, value] of candidates) {
    if (content.includes(Buffer.from(value))) leaks.push(`${name} in ${path.relative(buildDirectory, filename)}`)
  }
}
if (leaks.length) throw new Error(`Secret values found in production assets:\n${leaks.join("\n")}`)
console.log(`Scanned ${files(buildDirectory).length} production files for ${candidates.length} CI secrets`)
