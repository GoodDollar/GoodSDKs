import { defineConfig } from "tsup"
import { builtinModules } from "module"

const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`)
]

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"], // Only build ESM format since IIFE has issues with external dependencies
  platform: "browser",
  globalName: "ClaimButton",
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  minify: true,
  target: "ESNext",
  outDir: "dist",
  // Mark heavy dependencies as external to avoid bundling Node.js modules
  external: [
    // Mark the citizen-sdk as external since it has Node.js dependencies
    "@goodsdks/citizen-sdk",
    // Mark viem as external since it's the main source of Node.js dependencies
    "viem",
    // Dynamically include all Node.js built-ins
    ...nodeBuiltins
  ],
  // Only bundle UI-specific code, not blockchain/crypto libraries
  noExternal: [
    "lit",
    "@reown/appkit",
    "@reown/appkit-adapter-ethers",
    "ethers"
  ]
})
