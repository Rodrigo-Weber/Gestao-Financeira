import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:9999",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "/.netlify/functions"),
      },
    },
  },
});
