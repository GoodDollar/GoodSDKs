import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "iife"],
  platform: "browser",
  globalName: "ClaimButton",
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  minify: true,
  target: "ESNext",
  outDir: "dist",
})
