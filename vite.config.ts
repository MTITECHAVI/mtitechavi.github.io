import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages + custom domains safe default.
  // Keeps asset URLs relative in built index.html.
  base: "./",
  build: {
    // GitHub Pages supports publishing from /docs on main branch.
    outDir: "docs",
    assetsDir: "assets",
    sourcemap: false,
  },
});

