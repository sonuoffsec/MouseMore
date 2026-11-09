import { defineConfig } from "vitest/config";

// Separate from vite.config.ts: tests need no plugins, and Vitest bundles its own Vite.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
