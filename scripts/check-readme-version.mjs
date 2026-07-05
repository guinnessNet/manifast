// Release guard: the README version badge must match package.json's version.
// Wired into `prepublishOnly`, so a version bump that forgets to refresh the
// README (badge + the surrounding "what's new" prose) fails the publish instead
// of shipping stale docs. Update README.md — at minimum the `> vX.Y.Z ·` badge —
// whenever you bump the version.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const readme = readFileSync(join(root, "README.md"), "utf8");

const m = readme.match(/^>\s*v(\d+\.\d+\.\d+)\s/m);
if (!m) {
  console.error('✗ README.md is missing the "> vX.Y.Z ·" version badge line.');
  process.exit(1);
}
if (m[1] !== pkg.version) {
  console.error(
    `✗ README version badge (v${m[1]}) does not match package.json (v${pkg.version}).\n` +
      `  Update README.md for this release — the badge AND the relevant "what's new" content — then retry.`,
  );
  process.exit(1);
}
console.log(`✓ README badge matches package.json (v${pkg.version}).`);
