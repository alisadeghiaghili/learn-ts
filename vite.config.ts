import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    assetsInlineLimit: 0,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
