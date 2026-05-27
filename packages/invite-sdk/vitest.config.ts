import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@goodsdks/citizen-sdk": path.resolve(
        __dirname,
        "../citizen-sdk/src/index.ts",
      ),
    },
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: 60000,
  },
})
