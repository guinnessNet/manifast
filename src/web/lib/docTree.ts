import type { DocMeta } from "@shared/types";

/**
 * A folder node in the docs navigation tree. The doc list is flat (each DocMeta
 * carries a project-root-relative `path`); this turns it into a nested
 * folder→folder→doc hierarchy the sidebar can collapse/expand like a file tree.
 */
export interface DocTreeFolder {
  /** Full folder path relative to the project root (e.g. "docs/specs/claim"). "" = synthetic root. */
  path: string;
  /** Display segment (last path component); "" for the synthetic root. */
  name: string;
  /** Sub-folders, sorted by name. */
  folders: DocTreeFolder[];
  /** Docs that live directly in this folder, sorted by title. */
  docs: DocMeta[];
  /** Recursive doc count (this folder + every descendant). */
  count: number;
}

// Keep the friendly labels the flat list used for the agent-authored folders.
const FOLDER_LABELS: Record<string, string> = {
  ".manifast/prd": "PRD",
  ".manifast/specs": "Specs",
};

/** Human label for a folder node (special-cases the manifast-authored folders). */
export function folderLabel(folder: DocTreeFolder): string {
  return FOLDER_LABELS[folder.path] ?? folder.name;
}

/** Normalize a path's separators (Windows authors may produce backslashes). */
function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Build a nested folder tree from a flat doc list. Folders are created lazily as
 * each doc's path is walked; root-level files (no folder) land in `root.docs`.
 * Folders sort before files at every level; both are sorted, and each folder's
 * recursive `count` is computed.
 */
export function buildDocTree(docs: DocMeta[]): DocTreeFolder {
  const root: DocTreeFolder = { path: "", name: "", folders: [], docs: [], count: 0 };
  const index = new Map<string, DocTreeFolder>([["", root]]);

  const folderFor = (segments: string[]): DocTreeFolder => {
    let cur = root;
    let acc = "";
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      let next = index.get(acc);
      if (!next) {
        next = { path: acc, name: seg, folders: [], docs: [], count: 0 };
        index.set(acc, next);
        cur.folders.push(next);
      }
      cur = next;
    }
    return cur;
  };

  for (const d of docs) {
    const parts = norm(d.path).split("/").filter(Boolean);
    folderFor(parts.slice(0, -1)).docs.push(d); // drop the filename segment
  }

  sortFolder(root);
  return root;
}

/** Recursively sort folders (by name) + docs (by title) and roll up counts. */
function sortFolder(f: DocTreeFolder): number {
  f.folders.sort((a, b) => a.name.localeCompare(b.name));
  f.docs.sort((a, b) => a.title.localeCompare(b.title));
  let count = f.docs.length;
  for (const child of f.folders) count += sortFolder(child);
  f.count = count;
  return count;
}

/** Every folder path in the tree (used by "collapse all"). */
export function allFolderPaths(root: DocTreeFolder): string[] {
  const out: string[] = [];
  const walk = (f: DocTreeFolder) => {
    for (const child of f.folders) {
      out.push(child.path);
      walk(child);
    }
  };
  walk(root);
  return out;
}
