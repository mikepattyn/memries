import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";
import { libraryPhotosPlugin, resolvePhotosRoot } from "./libraryPhotosPlugin";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const photosRoot = resolvePhotosRoot(configDir);

const fsAllow = [searchForWorkspaceRoot(process.cwd())];
if (fs.existsSync(photosRoot)) fsAllow.push(photosRoot);

export default defineConfig({
  plugins: [react(), libraryPhotosPlugin(photosRoot)],
  resolve: {
    alias: {
      "@photos": photosRoot,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    fs: {
      allow: fsAllow,
    },
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
      "/oauth": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
});
