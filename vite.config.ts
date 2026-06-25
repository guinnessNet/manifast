import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const apiTarget = process.env.MANIFAST_API ?? "http://localhost:4317";

// The Vite dev server (5173) serves the SPA with HMR and proxies API + WS
// to the Fastify server (4317) started by `tsx watch src/server/standalone.ts`.
export default defineConfig({
  root: path.resolve(root, "src/web"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@shared": path.resolve(root, "src/shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/ws": { target: apiTarget, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: path.resolve(root, "dist/web"),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
