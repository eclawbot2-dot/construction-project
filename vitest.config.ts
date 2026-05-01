import { defineConfig } from "vitest/config";
import path from "path";

// Vitest config — runs the security-critical helper tests against the
// codebase without spinning up Next.js. Tests should be fast and pure
// (no Prisma, no fetch); for anything DB-dependent, gate on an env flag.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 5000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
