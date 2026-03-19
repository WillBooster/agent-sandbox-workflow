import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["workspace/**", "dist/**", "node_modules/**"],
  },
});
