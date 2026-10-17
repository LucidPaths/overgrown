import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: { fs: { allow: [resolve(__dirname, "..")] } },
  build: {
    target: "es2022",
    rollupOptions: { input: { index: resolve(__dirname, "index.html"), sketch: resolve(__dirname, "sketch.html"), characters: resolve(__dirname, "characters.html") } },
  },
  worker: { format: "es" },
});
