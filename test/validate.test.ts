import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { validateWorkspace } from "../src/cli/validate";
import { makeTempProject, writeFixture } from "./helpers";

let dir: string;
let dispose: () => Promise<void>;
const run = () => validateWorkspace(path.join(dir, ".manifast"), dir);

beforeEach(async () => {
  ({ dir, dispose } = await makeTempProject());
});
afterEach(() => dispose());

const wf = (id: string) =>
  JSON.stringify({
    schema: "manifast.wireframe/1",
    id,
    name: id,
    device: "desktop",
    size: { w: 1280, h: 800 },
    root: [{ type: "Box", id: "b1", frame: { x: 0, y: 0, w: 100, h: 100 } }],
  });

describe("validateWorkspace", () => {
  it("passes a clean workspace with resolvable links", async () => {
    await writeFixture(dir, ".manifast/wireframes/login.json", wf("login"));
    await writeFixture(
      dir,
      ".manifast/tasks/tasks.json",
      JSON.stringify({ schema: "manifast.tasks/1", tasks: [{ id: "t1", title: "T1", status: "todo" }] }),
    );
    await writeFixture(
      dir,
      ".manifast/specs/feat.md",
      "---\nschema: manifast.doc/1\nid: feat\ntype: spec\ntitle: Feat\nwireframe: login\ntasks: [t1]\n---\n\nbody\n",
    );
    const r = await run();
    expect(r.ok).toBe(true);
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("flags a broken wireframe link and a broken task link", async () => {
    await writeFixture(
      dir,
      ".manifast/specs/feat.md",
      "---\nschema: manifast.doc/1\nid: feat\ntype: spec\ntitle: Feat\nwireframe: ghost\ntasks: [nope]\n---\n\nbody\n",
    );
    const r = await run();
    expect(r.ok).toBe(false);
    const msgs = r.issues.map((i) => i.message).join("\n");
    expect(msgs).toContain('wireframe "ghost" not found');
    expect(msgs).toContain('task "nope" not found');
  });

  it("flags duplicate authored ids", async () => {
    await writeFixture(dir, ".manifast/wireframes/a.json", wf("dup"));
    await writeFixture(dir, ".manifast/wireframes/b.json", wf("dup"));
    const r = await run();
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.level === "error" && /duplicate wireframe id: "dup"/.test(i.message))).toBe(true);
  });

  it("reports invalid JSON as an error", async () => {
    await writeFixture(dir, ".manifast/wireframes/bad.json", "{ not json");
    const r = await run();
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.level === "error")).toBe(true);
  });
});
