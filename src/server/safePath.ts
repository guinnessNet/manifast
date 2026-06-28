import { realpathSync } from "node:fs";
import path from "node:path";

/** True when `target` is `root` itself or lives underneath it (lexical check). */
export function within(root: string, target: string): boolean {
  const r = path.resolve(root);
  const t = path.resolve(target);
  return t === r || t.startsWith(r + path.sep);
}

/**
 * realpath of `p`, or — when `p` doesn't exist yet — the realpath of its nearest
 * existing ancestor with the missing tail re-appended. This makes the result
 * symlink-resolved even for not-yet-created files, so a symlinked *parent*
 * directory can't smuggle a write outside the root.
 */
function realOrNearest(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    const parent = path.dirname(p);
    if (parent === p) return p; // filesystem root reached
    return path.join(realOrNearest(parent), path.basename(p));
  }
}

/**
 * Resolve `rel` under `root` and confine it there, **following symlinks** so a
 * link inside the workspace can't point outside it. Returns the absolute path,
 * or null if `rel` is empty or escapes the root (lexically or via a symlink).
 *
 * The lexical `within` check runs first as a cheap reject; the realpath check
 * then catches symlink escapes that the string-prefix test alone would miss.
 */
export function confine(root: string, rel: string): string | null {
  if (!rel) return null;
  const abs = path.resolve(root, rel);
  if (!within(root, abs)) return null;
  return isConfined(root, abs) ? abs : null;
}

/**
 * True when the absolute path `abs` stays inside `root` after resolving symlinks
 * on both sides. Use this to confine *discovered* paths (directory listings,
 * walked files) so a junction/symlink at a top-level source dir can't pull
 * outside files (or their metadata) into the workspace.
 */
export function isConfined(root: string, abs: string): boolean {
  const realRoot = realOrNearest(path.resolve(root));
  const realTarget = realOrNearest(path.resolve(abs));
  return within(realRoot, realTarget);
}
