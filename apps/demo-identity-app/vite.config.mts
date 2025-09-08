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
    allowedHosts: [
      "phases-financial-defence-equipment.trycloudflare.com" // I Added this for farcaster preview to allow the url
    ],
  },
  plugins: [react()],
  define: {
    "process.env": process.env,
  },
  build: {
    rollupOptions: {
      external: ["@goodsdks/citizen-sdk", "viem"],
    },
  },
});