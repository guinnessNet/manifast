import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInit } from "../src/cli/init";
import { makeTempProject } from "./helpers";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = path.join(repoRoot, "skill");

let dir: string;
let dispose: () => Promise<void>;
const run = () => runInit(dir, path.join(dir, ".manifast"), skillDir);

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
});
