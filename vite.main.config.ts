import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  build: {
    outDir: "dist-electron",
    emptyOutDir: false,
    target: "node20",
    lib: { entry: { "main/index": "src/main/index.ts", "preload/index": "src/preload/index.ts" }, formats: ["cjs"] },
    rollupOptions: { external: ["electron", "node:fs", "node:path", "node:child_process", "node:os", "node:crypto", "node:url", "node:events", "node:readline"] },
  },
  resolve: { alias: { "@shared": path.resolve(__dirname, "src/shared"), "@main": path.resolve(__dirname, "src/main") } },
});
