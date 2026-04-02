import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "iife"],
  platform: "browser",
  globalName: "GooddollarLiquidityWidget",
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  minify: true,
  target: "ESNext",
  outDir: "dist",
})
