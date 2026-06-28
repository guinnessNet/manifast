import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

// Unit + integration tests run in Node (server, parsers, pure web logic). The
// `@shared/*` alias mirrors tsconfig so tests import the same way the app does.
// Component/DOM tests (Phase 2) opt into jsdom per-file via a `// @vitest-environment`
// docblock, so the default stays the faster Node environment.
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(root, "src/shared"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    globals: false,
    // jest-dom matchers are only loaded for DOM-environment test files (which
    // opt in via a `// @vitest-environment jsdom` docblock).
    setupFiles: ["test/setup.dom.ts"],
  },
});
