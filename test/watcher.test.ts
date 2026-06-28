import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { resolveWatchRoots } from "../src/server/workspace";
import { createWatcher } from "../src/server/watcher";
import { makeTempProject, writeFixture } from "./helpers";

let dir: string;
let dispose: () => Promise<void>;
const mf = () => path.join(dir, ".manifast");

beforeEach(async () => {
  ({ dir, dispose } = await makeTempProject());
});
afterEach(() => dispose());

describe("resolveWatchRoots — the documented chokidar gotcha", () => {
  it("hands ONLY directories to chokidar and root files to fs.watch", async () => {
    await writeFixture(dir, ".manifast/manifast.json", JSON.stringify({ schema: "manifast/1", project: { name: "p" } }));
    await writeFixture(dir, "docs/a.md", "# A");
    await writeFixture(dir, "CLAUDE.md", "# root file");
    await writeFixture(dir, "README.md", "# readme");

    const { dirs, files } = await resolveWatchRoots(mf(), dir);

    // .manifast and docs are directories → chokidar (recursive) is fine.
    expect(dirs).toContain(mf());
    expect(dirs).toContain(path.resolve(dir, "docs"));

    // Root-level files go to fs.watch individually — NEVER their parent dir
    // (the project root), which would make chokidar watch the whole repo.
    expect(files).toContain(path.resolve(dir, "CLAUDE.md"));
    expect(files).toContain(path.resolve(dir, "README.md"));

    // Crucially: the project root itself is never a chokidar dir.
    expect(dirs).not.toContain(path.resolve(dir));
    // And no file's parent (the root) leaked into dirs.
    for (const f of files) expect(dirs).not.toContain(path.dirname(f));
  });

  it("does not duplicate a file source already covered by .manifast/", async () => {
    await writeFixture(dir, ".manifast/specs/x.md", "# X");
    const { files } = await resolveWatchRoots(mf(), dir);
    expect(files.every((f) => !f.startsWith(mf() + path.sep))).toBe(true);
  });
});

describe("createWatcher — change events", () => {
  it("emits a change event for a file written under a watched directory", async () => {
    await writeFixture(dir, ".manifast/tasks/tasks.json", "{}");
    const events: { type: string; relPath: string }[] = [];
    const handle = createWatcher([mf()], [], dir, (evs) => events.push(...evs), 30);
    try {
      // Give chokidar a beat to attach, then mutate a file.
      await new Promise((r) => setTimeout(r, 300));
      await writeFixture(dir, ".manifast/tasks/tasks.json", JSON.stringify({ schema: "manifast.tasks/1", tasks: [] }));
      await new Promise((r) => setTimeout(r, 500));
      expect(events.some((e) => e.relPath === ".manifast/tasks/tasks.json")).toBe(true);
    } finally {
      await handle.close();
    }
  });
});
