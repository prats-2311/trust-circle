import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "node", include: ["src/**/*.test.ts"], exclude: ["src/**/*.int.test.ts"] },
      },
      {
        extends: true,
        test: { name: "integration", environment: "node", include: ["src/**/*.int.test.ts"], fileParallelism: false },
      },
    ],
  },
});
