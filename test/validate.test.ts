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

  it("reports invalid JSON as a single error (no double-report)", async () => {
    await writeFixture(dir, ".manifast/wireframes/bad.json", "{ not json");
    const r = await run();
    expect(r.ok).toBe(false);
    const forFile = r.issues.filter((i) => i.path.endsWith("bad.json") && i.level === "error");
    expect(forFile.length).toBe(1);
  });

  it("treats an invalid manifast.doc/1 frontmatter as a warning, not an error", async () => {
    await writeFixture(
      dir,
      ".manifast/specs/warn.md",
      "---\nschema: manifast.doc/1\nid: warn\ntype: spec\ntitle: Warn\nreviewBy: soon\n---\n\nbody\n",
    );
    const r = await run();
    const forFile = r.issues.filter((i) => i.path.endsWith("warn.md"));
    expect(forFile.some((i) => i.level === "warning")).toBe(true);
    expect(forFile.some((i) => i.level === "error")).toBe(false);
    expect(r.ok).toBe(true); // warnings don't fail (caller applies --strict)
  });

  it("flags a broken deprecatedBy reference", async () => {
    await writeFixture(
      dir,
      ".manifast/specs/old.md",
      "---\nschema: manifast.doc/1\nid: old\ntype: spec\ntitle: Old\nstatus: deprecated\ndeprecatedBy: ghost\n---\n\nbody\n",
    );
    const r = await run();
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /deprecatedBy doc "ghost"/.test(i.message))).toBe(true);
  });

  it("flags a diagram edge pointing at a missing node", async () => {
    await writeFixture(
      dir,
      ".manifast/diagrams/d.json",
      JSON.stringify({
        schema: "manifast.diagram/1",
        id: "d",
        title: "D",
        nodes: [{ id: "a", label: "A" }],
        edges: [{ from: "a", to: "ghost" }],
      }),
    );
    const r = await run();
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /edge to "ghost"/.test(i.message))).toBe(true);
  });

  it("flags a diagram node.ref to a missing doc", async () => {
    await writeFixture(
      dir,
      ".manifast/diagrams/d2.json",
      JSON.stringify({
        schema: "manifast.diagram/1",
        id: "d2",
        title: "D2",
        nodes: [{ id: "a", label: "A", ref: { kind: "doc", id: "ghost" } }],
        edges: [],
      }),
    );
    const r = await run();
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /doc ref "ghost"/.test(i.message))).toBe(true);
  });

  it("flags a diagram node.ref of kind path to a missing file", async () => {
    await writeFixture(
      dir,
      ".manifast/diagrams/d3.json",
      JSON.stringify({
        schema: "manifast.diagram/1",
        id: "d3",
        title: "D3",
        nodes: [{ id: "a", label: "A", ref: { kind: "path", id: "docs/missing.md" } }],
        edges: [],
      }),
    );
    const r = await run();
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => /path ref "docs\/missing.md"/.test(i.message))).toBe(true);
  });

  it("accepts a diagram node.ref of kind path to an existing file", async () => {
    await writeFixture(dir, "docs/real.md", "# Real\n");
    await writeFixture(
      dir,
      ".manifast/diagrams/d4.json",
      JSON.stringify({
        schema: "manifast.diagram/1",
        id: "d4",
        title: "D4",
        nodes: [{ id: "a", label: "A", ref: { kind: "path", id: "docs/real.md" } }],
        edges: [],
      }),
    );
    const r = await run();
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
  });
});
