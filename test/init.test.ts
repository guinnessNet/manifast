import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInit, removeExamples } from "../src/cli/init";
import { access } from "node:fs/promises";
import { makeTempProject } from "./helpers";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = path.join(repoRoot, "skill");

let dir: string;
let dispose: () => Promise<void>;
const run = () => runInit(dir, path.join(dir, ".manifast"), skillDir);
const fileExists = (p: string) => access(p).then(() => true, () => false);
const exampleWireframe = ".manifast/wireframes/screen-login.json";

beforeEach(async () => {
  ({ dir, dispose } = await makeTempProject());
});
afterEach(() => dispose());

describe("runInit", () => {
  it("scaffolds the workspace + installs the skill on a fresh project", async () => {
    const report = await run();
    expect(report.created.length).toBeGreaterThan(0);
    // Managed JSON schema is installed under .manifast/schema.
    await expect(readFile(path.join(dir, ".manifast/schema/wireframe.schema.json"), "utf8")).resolves.toContain("manifast");
    await expect(stat(path.join(dir, ".manifast/diagrams")).then((s) => s.isDirectory())).resolves.toBe(true);
    // The Claude Code skill is installed.
    await expect(readFile(path.join(dir, ".claude/skills/manifast/SKILL.md"), "utf8")).resolves.toBeTruthy();
    // CLAUDE.md gets the durable managed block.
    const claude = await readFile(path.join(dir, "CLAUDE.md"), "utf8");
    expect(claude).toContain("<!-- manifast:begin -->");
    expect(claude).toContain("<!-- manifast:end -->");
  });

  it("is idempotent — a second run creates nothing new and reports up-to-date", async () => {
    await run();
    const second = await run();
    expect(second.created).toEqual([]);
    // The managed block appears exactly once (not appended again).
    const claude = await readFile(path.join(dir, "CLAUDE.md"), "utf8");
    expect((claude.match(/manifast:begin/g) ?? []).length).toBe(1);
  });

  it("never clobbers a user's own AGENTS.md, but still merges the managed block", async () => {
    await mkdir(dir, { recursive: true });
    const userContent = "# My own agents file\n\nCustom instructions the user wrote.\n";
    await writeFile(path.join(dir, "AGENTS.md"), userContent, "utf8");

    await run();
    const after = await readFile(path.join(dir, "AGENTS.md"), "utf8");
    // User's text outside the markers is preserved verbatim.
    expect(after).toContain("Custom instructions the user wrote.");
    // The managed block was merged in (once).
    expect((after.match(/manifast:begin/g) ?? []).length).toBe(1);
    // It was NOT replaced by the bundled Manifast authoring guide.
    expect(after).not.toContain("Manifast authoring guide");
  });

  it("does NOT seed demo content by default", async () => {
    await run();
    await expect(fileExists(path.join(dir, exampleWireframe))).resolves.toBe(false);
  });

  it("--example seeds demo content; --rm-example removes only unmodified files", async () => {
    const seeded = await runInit(dir, path.join(dir, ".manifast"), skillDir, { example: true });
    expect(seeded.created).toContain(exampleWireframe);
    await expect(fileExists(path.join(dir, exampleWireframe))).resolves.toBe(true);
    // A demo spec also lands so the Docs view isn't empty.
    await expect(fileExists(path.join(dir, ".manifast/specs/feat-auth.md"))).resolves.toBe(true);

    // The user edits one demo file — it must survive removal.
    const kept = path.join(dir, exampleWireframe);
    await writeFile(kept, JSON.stringify({ schema: "manifast.wireframe/1", id: "screen-login", name: "Mine", device: "mobile", size: { w: 1, h: 1 }, root: [] }), "utf8");

    const removed = await removeExamples(path.join(dir, ".manifast"), skillDir);
    // The edited file is preserved (reported as kept), the untouched ones go.
    expect(removed.removed).toContain(".manifast/diagrams/architecture.json");
    expect(removed.skipped.some((s) => s.startsWith(exampleWireframe))).toBe(true);
    await expect(fileExists(kept)).resolves.toBe(true);
    await expect(fileExists(path.join(dir, ".manifast/diagrams/architecture.json"))).resolves.toBe(false);
  });

  it("--example never overwrites an existing file", async () => {
    await mkdir(path.join(dir, ".manifast/specs"), { recursive: true });
    const mine = path.join(dir, ".manifast/specs/feat-auth.md");
    await writeFile(mine, "MY OWN SPEC", "utf8");

    const report = await runInit(dir, path.join(dir, ".manifast"), skillDir, { example: true });
    await expect(readFile(mine, "utf8")).resolves.toBe("MY OWN SPEC");
    expect(report.skipped.some((s) => s.includes("feat-auth.md") && s.includes("exists"))).toBe(true);
  });
});
