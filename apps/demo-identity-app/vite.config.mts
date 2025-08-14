import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import fs from "fs";

let https: any;
if (process.env.HTTPS === "true") {
  https = {
    key: fs.readFileSync(process.env.SSL_KEY_FILE as any),
    cert: fs.readFileSync(process.env.SSL_CRT_FILE as any),
  };
} else {
  https = false;
}

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom", "wagmi", "viem"],
    alias: {
      "@": path.resolve(__dirname, "/src"),
      "react-native": "react-native-web",
      "react-native-svg": "react-native-svg-web",
      "react-native-webview": "react-native-web-webview",
    },
  },
  server: {
    https,
  },
  plugins: [react()],
  define: {
    "process.browser": true,
    // Only define specific env vars instead of the entire process.env object
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
  },
  build: {
    rollupOptions: {
      external: [
        // External Node.js modules that should not be bundled for browser
        "crypto",
        "node:crypto",
        "http",
        "https", 
        "stream",
        "zlib",
        "node:buffer",
        "buffer",
        "util",
        "url",
        "querystring",
        "fs",
        "path",
        "os",
        "net",
        "tls",
        "assert"
      ],
      output: {
        globals: {
          // Provide browser globals for externalized modules
          "crypto": "crypto",
          "node:crypto": "crypto",
          "http": "http",
          "https": "https",
          "stream": "stream",
          "zlib": "zlib",
          "node:buffer": "Buffer",
          "buffer": "Buffer",
          "util": "util",
          "url": "URL",
          "querystring": "querystring",
          "fs": "fs",
          "path": "path",
          "os": "os",
          "net": "net",
          "tls": "tls",
          "assert": "assert"
        }
      }
    }
  }
});
