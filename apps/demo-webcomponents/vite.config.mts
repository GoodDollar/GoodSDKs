import { defineConfig } from "vite"
import path from "path"
import fs from "fs"

let https: any
if (process.env.HTTPS === "true") {
  https = {
    key: fs.readFileSync(process.env.SSL_KEY_FILE as any),
    cert: fs.readFileSync(process.env.SSL_CRT_FILE as any),
  }
} else {
  https = false
}



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
    "process.env": process.env,
  },

})
