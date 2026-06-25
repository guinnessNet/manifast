import chokidar from "chokidar";
import { watch as fsWatch, type FSWatcher as NodeFSWatcher } from "node:fs";
import path from "node:path";

export interface WatchEvent {
  type: "add" | "change" | "unlink";
  relPath: string; // relative to the project root, posix separators
}

export interface WatchHandle {
  close: () => Promise<void>;
}

const IGNORE_SEGMENTS = new Set(["node_modules", ".git", "dist"]);

function relToProject(projectDir: string, abs: string): string {
  return path.relative(projectDir, abs).replace(/\\/g, "/");
}

function isIgnoredRel(rel: string): boolean {
  if (!rel) return false;
  return rel
    .split("/")
    .some((seg) => (seg.startsWith(".") && seg !== ".manifast") || IGNORE_SEGMENTS.has(seg));
}

/**
 * Watch the given directory roots recursively (chokidar) plus individual files
 * (Node fs.watch — non-recursive). Watching files individually is important:
 * handing a root-level file like CLAUDE.md to chokidar makes it watch the whole
 * project root recursively (build/, data/, …), which can stall the server.
 */
export function createWatcher(
  dirRoots: string[],
  fileRoots: string[],
  projectDir: string,
  onEvents: (events: WatchEvent[]) => void,
  debounceMs = 100,
): WatchHandle {
  const pending = new Map<string, WatchEvent["type"]>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (pending.size === 0) return;
    const events: WatchEvent[] = [];
    for (const [relPath, type] of pending) events.push({ type, relPath });
    pending.clear();
    onEvents(events);
  };

  const schedule = (type: WatchEvent["type"], abs: string) => {
    const rel = relToProject(projectDir, abs);
    if (!rel || rel.startsWith("..")) return;
    if (isIgnoredRel(rel)) return;
    pending.set(rel, type);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  const watcher = chokidar.watch(dirRoots, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 30 },
    ignored: (p: string) => isIgnoredRel(relToProject(projectDir, p)),
  });
  watcher.on("add", (p) => schedule("add", p));
  watcher.on("change", (p) => schedule("change", p));
  watcher.on("unlink", (p) => schedule("unlink", p));

  const fileWatchers: NodeFSWatcher[] = [];
  for (const f of fileRoots) {
    try {
      fileWatchers.push(fsWatch(f, () => schedule("change", f)));
    } catch {
      /* file may not exist / platform quirk — skip */
    }
  }

  return {
    close: async () => {
      for (const fw of fileWatchers) {
        try {
          fw.close();
        } catch {
          /* ignore */
        }
      }
      await watcher.close();
    },
  };
}
