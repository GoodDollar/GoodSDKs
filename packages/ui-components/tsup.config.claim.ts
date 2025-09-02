import { defineConfig } from "tsup"
import { getExternalDependencies } from "../build-config"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "iife"],
  platform: "browser",
  globalName: "ClaimButton",
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  minify: true,
  target: "ESNext",
  outDir: "dist",
  external: getExternalDependencies([
    "@goodsdks/citizen-sdk",
    "viem"
  ]),
})