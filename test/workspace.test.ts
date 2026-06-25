import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import {
  readWorkspace,
  readFileResource,
  classifyPath,
  validatePath,
  listAllFiles,
} from "../src/server/workspace";
import { makeTempProject, writeFixture } from "./helpers";

let dir: string;
let dispose: () => Promise<void>;
const mf = () => path.join(dir, ".manifast");

beforeEach(async () => {
  ({ dir, dispose } = await makeTempProject());
});
afterEach(() => dispose());

describe("classifyPath", () => {
  it("maps known paths to their kind", () => {
    expect(classifyPath(".manifast/manifast.json")).toBe("manifest");
    expect(classifyPath(".manifast/tasks/tasks.json")).toBe("tasks");
    expect(classifyPath(".manifast/plan/plan.json")).toBe("plan");
    expect(classifyPath(".manifast/wireframes/login.json")).toBe("wireframe");
    expect(classifyPath(".manifast/diagrams/arch.json")).toBe("diagram");
    expect(classifyPath("docs/guide.md")).toBe("doc");
    expect(classifyPath("CLAUDE.md")).toBe("doc");
    expect(classifyPath("package.json")).toBe("other");
  });

  it("classifies windows-style backslash paths too", () => {
    expect(classifyPath(".manifast\\wireframes\\login.json")).toBe("wireframe");
  });
});

describe("readWorkspace — doc discovery & parsing", () => {
  it("infers doc type from path and frontmatter", async () => {
    await writeFixture(dir, "docs/adr/0001-choice.md", "# ADR");
    await writeFixture(dir, "docs/architecture/system.md", "# Arch");
    await writeFixture(dir, ".manifast/specs/feat.md", "# Feat");
    await writeFixture(dir, "docs/notes.md", "# Notes");
    await writeFixture(dir, "docs/typed.md", "---\nschema: manifast.doc/1\nid: typed\ntype: reference\ntitle: T\n---\nbody");

    const ws = await readWorkspace(mf(), dir);
    const byId = (p: string) => ws.items.docs.find((d) => d.path === p);
    expect(byId("docs/adr/0001-choice.md")?.type).toBe("adr");
    expect(byId("docs/architecture/system.md")?.type).toBe("architecture");
    expect(byId(".manifast/specs/feat.md")?.type).toBe("spec");
    expect(byId("docs/notes.md")?.type).toBe("doc");
    expect(byId("docs/typed.md")?.type).toBe("reference"); // frontmatter wins
  });

  it("derives a slug id from the path when no frontmatter id is present", async () => {
    await writeFixture(dir, "docs/sub/My Guide.md", "# Hi");
    const ws = await readWorkspace(mf(), dir);
    const d = ws.items.docs.find((x) => x.path === "docs/sub/My Guide.md");
    expect(d?.id).toBe("docs-sub-My-Guide");
  });

  it("marks docs under an archive/ folder as archived", async () => {
    await writeFixture(dir, "docs/archive/old.md", "# Old");
    const ws = await readWorkspace(mf(), dir);
    expect(ws.items.docs.find((d) => d.path === "docs/archive/old.md")?.status).toBe("archived");
  });

  it("normalizes unquoted YAML dates to ISO date strings", async () => {
    await writeFixture(
      dir,
      "docs/dated.md",
      "---\nschema: manifast.doc/1\nid: dated\ntype: doc\ntitle: D\ncreatedAt: 2024-01-02\n---\nbody",
    );
    const ws = await readWorkspace(mf(), dir);
    const d = ws.items.docs.find((x) => x.path === "docs/dated.md");
    expect(d?.createdAt).toBe("2024-01-02");

    const fileResp = await readFileResource(dir, "docs/dated.md");
    if (fileResp.kind === "doc") expect(fileResp.frontmatter?.createdAt).toBe("2024-01-02");
  });

  it("parses related + sources arrays into the DTO", async () => {
    await writeFixture(
      dir,
      "docs/a.md",
      "---\nschema: manifast.doc/1\nid: a\ntype: doc\ntitle: A\nrelated: [b, c]\nsources: [src/x.ts]\n---\n",
    );
    const ws = await readWorkspace(mf(), dir);
    const d = ws.items.docs.find((x) => x.path === "docs/a.md");
    expect(d?.related).toEqual(["b", "c"]);
    expect(d?.sources).toEqual(["src/x.ts"]);
  });

  it("only reads the head of a doc for the title (16KB truncation)", async () => {
    // No H1 in the first 16KB, an H1 far past it → title must fall back to the
    // filename, proving the body beyond the head window was not scanned.
    const filler = "x\n".repeat(12000); // ~24KB, no '#'
    await writeFixture(dir, "docs/huge.md", filler + "\n# LATE TITLE\n");
    const ws = await readWorkspace(mf(), dir);
    const d = ws.items.docs.find((x) => x.path === "docs/huge.md");
    expect(d?.title).toBe("huge");
    expect(d?.title).not.toBe("LATE TITLE");
  });

  it("reflects edits on re-read (mtime/size cache invalidation)", async () => {
    await writeFixture(dir, "docs/m.md", "# First");
    const first = (await readWorkspace(mf(), dir)).items.docs.find((x) => x.path === "docs/m.md");
    expect(first?.title).toBe("First");
    // Rewrite with different content+size; mtime advances → cache miss → fresh meta.
    await new Promise((r) => setTimeout(r, 10));
    await writeFixture(dir, "docs/m.md", "# Second changed title");
    const second = (await readWorkspace(mf(), dir)).items.docs.find((x) => x.path === "docs/m.md");
    expect(second?.title).toBe("Second changed title");
  });

  it("surfaces invalid wireframe JSON as a workspace error without crashing", async () => {
    await writeFixture(dir, ".manifast/wireframes/bad.json", "{ not json");
    const ws = await readWorkspace(mf(), dir);
    expect(ws.items.wireframes.find((w) => w.path === ".manifast/wireframes/bad.json")?.ok).toBe(false);
    expect(ws.errors.some((e) => e.path === ".manifast/wireframes/bad.json")).toBe(true);
  });
});

describe("readFileResource / validatePath — path confinement", () => {
  it("rejects ../ traversal out of the project root", async () => {
    const res = await readFileResource(dir, "../secret.md");
    expect(res.ok).toBe(false);
  });

  it("rejects an absolute path escape", async () => {
    const res = await readFileResource(dir, path.resolve(dir, "..", "etc-passwd"));
    expect(res.ok).toBe(false);
  });

  it("validatePath rejects an escaping wireframe path", async () => {
    // Classifies as a wireframe (under .manifast/wireframes/, .json) but the
    // resolved target escapes the project root → must be rejected.
    const v = await validatePath(dir, ".manifast/wireframes/../../../../etc/hosts.json");
    expect(v.ok).toBe(false);
  });

  it("reads a confined doc successfully", async () => {
    await writeFixture(dir, "docs/ok.md", "# OK\n\nbody");
    const res = await readFileResource(dir, "docs/ok.md");
    expect(res.ok).toBe(true);
    if (res.kind === "doc") expect(res.markdown).toContain("body");
  });
});

describe("listAllFiles", () => {
  it("lists project-root-relative posix paths under .manifast/", async () => {
    await writeFixture(dir, ".manifast/wireframes/a.json", "{}");
    await writeFixture(dir, ".manifast/tasks/tasks.json", "{}");
    const files = await listAllFiles(mf(), dir);
    expect(files).toContain(".manifast/wireframes/a.json");
    expect(files).toContain(".manifast/tasks/tasks.json");
    expect(files.every((f) => !f.includes("\\"))).toBe(true);
  });
});
