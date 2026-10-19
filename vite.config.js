import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  esbuild: { jsx: "automatic" },
  build: {
    assetsInlineLimit: 1000000,
    cssCodeSplit: false,
    rollupOptions: { output: { manualChunks: undefined } },
  },
});
