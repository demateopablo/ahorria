import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["shared/**/*.test.ts", "server/**/*.test.ts", "seed/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Los tests de API comparten una base: sin paralelismo entre archivos.
    fileParallelism: false,
  },
});
