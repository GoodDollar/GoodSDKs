import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom", "wagmi", "viem"],
    alias: {
      "@": path.resolve(__dirname, "/src"),
    },
  },
  plugins: [react()],
  define: {
    "process.browser": true,
    "process.env": process.env,
  },
});
