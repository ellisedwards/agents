import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const buildId = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
fs.writeFileSync("dist/.build-id", buildId);

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4747",
    },
  },
  build: {
    outDir: "dist/client",
  },
});
