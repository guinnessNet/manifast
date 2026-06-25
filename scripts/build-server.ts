import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Bundle the CLI (which pulls in the server + shared schema) into a single
// ESM file. All third-party packages stay external (resolved from node_modules
// at runtime); only our own source is bundled.
await build({
  entryPoints: [path.join(root, "src/cli/index.ts")],
  outfile: path.join(root, "dist/cli/index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  packages: "external",
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "info",
});

console.log("Built dist/cli/index.js");
