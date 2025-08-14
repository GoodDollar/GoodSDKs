import { defineConfig } from "vite"
import path from "path"
import fs from "fs"
import { builtinModules } from "module"

let https: any
if (process.env.HTTPS === "true") {
  https = {
    key: fs.readFileSync(process.env.SSL_KEY_FILE as any),
    cert: fs.readFileSync(process.env.SSL_CRT_FILE as any),
  }
} else {
  https = false
}

const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`)
]

const nodeBuiltinGlobals = nodeBuiltins.reduce((acc, name) => {
  // Strip the `node:` prefix for the global key if present
  const key = name.startsWith('node:') ? name.slice(5) : name
  // Map both `foo` and `node:foo` → global `foo`
  acc[name] = key
  return acc
}, {} as Record<string, string>)

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "/src"),
    },
  },
  server: {
    https,
  },
  define: {
    "process.browser": true,
    // Only define specific env vars instead of the entire process.env object
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
  },
  build: {
    rollupOptions: {
      external: nodeBuiltins,
      output: {
        globals: nodeBuiltinGlobals
      }
    }
  }
})
