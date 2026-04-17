import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages + custom domains safe default.
  // Keeps asset URLs relative in built index.html.
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
  },
});

