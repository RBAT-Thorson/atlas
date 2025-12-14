// @ts-check
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const host = process.env.TAURI_DEV_HOST;

// reconstruct __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(async () => ({
  plugins: [sveltekit()],

  resolve: {
    alias: {
      // ✅ $lib resolves to your src/lib folder
      $lib: resolve(__dirname, "src/lib"),
    },
  },

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
