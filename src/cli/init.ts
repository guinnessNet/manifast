import { mkdir, readdir, access, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

export interface InitReport {
  created: string[];
  updated: string[];
  skipped: string[];
  removed: string[];
}

function emptyReport(): InitReport {
  return { created: [], updated: [], skipped: [], removed: [] };
}

const sameContent = (a: string, b: string) =>
  a.replace(/\r\n/g, "\n") === b.replace(/\r\n/g, "\n");

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}


// Refresh a Manifast-managed file: overwrite when content differs (so upgrades
// reach existing projects), skip when identical, and — if onlyIfMarker is given —
// leave the file untouched unless it contains that marker (so a user's own file
// of the same name is never clobbered). EOL differences alone don't count.
async function copyFileRefresh(
  src: string,
  dest: string,
  rel: string,
  report: InitReport,
  opts?: { onlyIfMarker?: string },
): Promise<void> {
  if (!(await exists(src))) return;
  const srcContent = await readFile(src, "utf8");
  let destContent: string | null = null;
  try {
    destContent = await readFile(dest, "utf8");
  } catch {
    destContent = null;
  }

  if (destContent == null) {
    await ensureDir(path.dirname(dest));
    await writeFile(dest, srcContent, "utf8");
    report.created.push(rel);
    return;
  }
  const norm = (s: string) => s.replace(/\r\n/g, "\n");
  if (norm(destContent) === norm(srcContent)) {
    report.skipped.push(`${rel} (up to date)`);
    return;
  }
  if (opts?.onlyIfMarker && !destContent.includes(opts.onlyIfMarker)) {
    report.skipped.push(`${rel} (kept — not Manifast-managed)`);
    return;
  }
  await writeFile(dest, srcContent, "utf8");
  report.updated.push(rel);
}

async function copyTreeRefresh(srcDir: string, destDir: string, relBase: string, report: InitReport): Promise<void> {
  let entries;
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const s = path.join(srcDir, e.name);
    const d = path.join(destDir, e.name);
    const rel = relBase ? `${relBase}/${e.name}` : e.name;
    if (e.isDirectory()) await copyTreeRefresh(s, d, rel, report);
    else if (e.isFile()) await copyFileRefresh(s, d, rel, report);
  }
}


// --- Demo example content (`init --example` / `init --rm-example`) ----------
// A small sample `.manifast/` workspace so the views aren't empty before an
// agent has authored anything. Seeding NEVER overwrites an existing file (your
// own work is safe); removal deletes ONLY files that still match the seed
// verbatim, so anything you edited or added is preserved.

function exampleSrcDir(skillDir: string): string {
  return path.join(skillDir, "examples", ".manifast");
}

// Copy each example file into the workspace only if absent (create-only).
async function seedTree(srcDir: string, destDir: string, relBase: string, report: InitReport): Promise<void> {
  let entries;
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const s = path.join(srcDir, e.name);
    const d = path.join(destDir, e.name);
    const rel = relBase ? `${relBase}/${e.name}` : e.name;
    if (e.isDirectory()) {
      await seedTree(s, d, rel, report);
    } else if (e.isFile()) {
      if (await exists(d)) {
        report.skipped.push(`${rel} (exists)`);
        continue;
      }
      await ensureDir(path.dirname(d));
      await writeFile(d, await readFile(s, "utf8"), "utf8");
      report.created.push(rel);
    }
  }
}

// Delete example files only where the on-disk content still matches the seed.
async function removeTree(srcDir: string, destDir: string, relBase: string, report: InitReport): Promise<void> {
  let entries;
  try {
    entries = await readdir(srcDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const s = path.join(srcDir, e.name);
    const d = path.join(destDir, e.name);
    const rel = relBase ? `${relBase}/${e.name}` : e.name;
    if (e.isDirectory()) {
      await removeTree(s, d, rel, report);
      continue;
    }
    if (!e.isFile()) continue;
    let destContent: string;
    try {
      destContent = await readFile(d, "utf8");
    } catch {
      continue; // not present — nothing to remove
    }
    const srcContent = await readFile(s, "utf8");
    if (sameContent(destContent, srcContent)) {
      await rm(d, { force: true });
      report.removed.push(rel);
    } else {
      report.skipped.push(`${rel} (modified — kept)`);
    }
  }
}

/** Remove unmodified seeded example files. Anything you changed is left alone. */
export async function removeExamples(manifastDir: string, skillDir: string): Promise<InitReport> {
  const report = emptyReport();
  await removeTree(exampleSrcDir(skillDir), manifastDir, ".manifast", report);
  return report;
}


// --- Durable directive (constitution block) --------------------------------
// init merges a small, marker-delimited managed block into the project's
// CLAUDE.md / AGENTS.md so future agent sessions keep authoring docs via the
// skill. Content OUTSIDE the markers is never touched; re-running updates only
// the block (idempotent). See DESIGN.md 부록 D.1.

const BLOCK_BEGIN = "<!-- manifast:begin -->";
const BLOCK_END = "<!-- manifast:end -->";
const BLOCK_RE = /<!-- manifast:begin -->[\s\S]*?<!-- manifast:end -->/;

function constitutionBlock(): string {
  return [
    BLOCK_BEGIN,
    "<!-- This block is managed by `manifast init`. Edit freely only outside the markers. -->",
    "## Manifast — document authoring rules",
    "",
    "This project's **planning & design artifacts** (wireframes · PRD/specs · task board · roadmap ·",
    "architecture/doc-map diagrams · structured docs) are authored and updated **only via the Manifast skill rules**.",
    "",
    "- **Every agent (Claude · Codex · others)** must, before creating or editing, first read `.manifast/AGENTS.md`",
    "  (the full authoring guide + schema & procedures) and follow its rules. Do not touch them in ad-hoc formats.",
    "  (Claude Code also auto-loads `.claude/skills/manifast/SKILL.md`.)",
    "- Put new planning docs in `.manifast/` (or a tracked `docs/`) per the rules.",
    "- When the code a doc describes (frontmatter `sources`) changes, update the doc in the same change.",
    "- After authoring/editing, validate with `npx manifast validate`. Errors mean it did not pass.",
    "- This rule is not enforced for ordinary code/README touch-ups.",
    BLOCK_END,
  ].join("\n");
}

/**
 * Insert/refresh the managed block in a file. Never touches text outside the
 * markers. Creates the file (with an optional prefix) when absent.
 */
async function mergeManagedBlock(
  absPath: string,
  rel: string,
  report: InitReport,
  prefixWhenNew = "",
): Promise<void> {
  const block = constitutionBlock();
  let existing: string | null = null;
  try {
    existing = await readFile(absPath, "utf8");
  } catch {
    existing = null;
  }

  if (existing == null) {
    await ensureDir(path.dirname(absPath));
    await writeFile(absPath, prefixWhenNew + block + "\n", "utf8");
    report.created.push(rel);
    return;
  }
  if (BLOCK_RE.test(existing)) {
    const next = existing.replace(BLOCK_RE, block);
    if (next === existing) {
      report.skipped.push(`${rel} (directive up to date)`);
      return;
    }
    await writeFile(absPath, next, "utf8");
    report.updated.push(`${rel} (directive)`);
    return;
  }
  const next = existing.replace(/\s*$/, "") + "\n\n" + block + "\n";
  await writeFile(absPath, next, "utf8");
  report.updated.push(`${rel} (directive)`);
}

/**
 * Scaffold .manifast/ and install/refresh Manifast-managed agent assets.
 * User-owned content is preserved: managed files are refreshed, marker blocks
 * are merged, and unmanaged root instructions keep their text outside markers.
 */
export async function runInit(
  projectDir: string,
  manifastDir: string,
  skillDir: string,
  opts: { example?: boolean } = {},
): Promise<InitReport> {
  const report = emptyReport();

  // 1. Scaffold folder structure.
  for (const f of ["wireframes", "prd", "specs", "tasks", "plan", "diagrams", "schema"]) {
    await ensureDir(path.join(manifastDir, f));
  }

  // 2. JSON Schema (validation contract for agents) — refresh on upgrade.
  await copyTreeRefresh(
    path.join(skillDir, "schema"),
    path.join(manifastDir, "schema"),
    ".manifast/schema",
    report,
  );

  // 2b. Canonical, LLM-neutral authoring guide. Always installed inside
  // .manifast/ (no user-file conflict), so the durable directive can point every
  // agent — Claude, Codex, anything — at one path that is guaranteed to exist
  // and to carry the full schema/procedures.
  await copyFileRefresh(
    path.join(skillDir, "AGENTS.md"),
    path.join(manifastDir, "AGENTS.md"),
    ".manifast/AGENTS.md",
    report,
  );

  // 3. Claude Code skill — Manifast-managed, refresh on upgrade.
  await copyFileRefresh(
    path.join(skillDir, "SKILL.md"),
    path.join(projectDir, ".claude", "skills", "manifast", "SKILL.md"),
    ".claude/skills/manifast/SKILL.md",
    report,
  );

  // 4. Codex / general-purpose instructions (full guide). Refresh only if the
  // existing AGENTS.md is the Manifast guide — never clobber a user's own.
  await copyFileRefresh(
    path.join(skillDir, "AGENTS.md"),
    path.join(projectDir, "AGENTS.md"),
    "AGENTS.md",
    report,
    { onlyIfMarker: "Manifast authoring guide" },
  );

  // 4b. Durable directive — merge the managed block into AGENTS.md (the full
  // guide created above, or a pre-existing one) and CLAUDE.md. A fresh CLAUDE.md
  // imports @AGENTS.md because Claude Code reads CLAUDE.md, not AGENTS.md.
  await mergeManagedBlock(path.join(projectDir, "AGENTS.md"), "AGENTS.md", report);
  await mergeManagedBlock(path.join(projectDir, "CLAUDE.md"), "CLAUDE.md", report, "@AGENTS.md\n\n");

  // 5. Completion checklist skill — Manifast-managed, refresh on upgrade.
  await copyFileRefresh(
    path.join(skillDir, "CHECKLIST.md"),
    path.join(projectDir, ".claude", "skills", "manifast", "CHECKLIST.md"),
    ".claude/skills/manifast/CHECKLIST.md",
    report,
  );

  // 6. Workflow overview (reference doc inside manifast skill) — Manifast-managed.
  await copyFileRefresh(
    path.join(skillDir, "WORKFLOW.md"),
    path.join(projectDir, ".claude", "skills", "manifast", "WORKFLOW.md"),
    ".claude/skills/manifast/WORKFLOW.md",
    report,
  );

  // 7. Standalone workflow skills — installed as sibling skills next to manifast.
  for (const skill of ["brainstorm", "write-plan", "implement"] as const) {
    await copyFileRefresh(
      path.join(skillDir, "skills", skill, "SKILL.md"),
      path.join(projectDir, ".claude", "skills", skill, "SKILL.md"),
      `.claude/skills/${skill}/SKILL.md`,
      report,
    );
  }

  // 8. Optional demo content so the views aren't empty before an agent authors
  //    anything. Never overwrites an existing file; remove later with
  //    `manifast init --rm-example`.
  if (opts.example) {
    await seedTree(exampleSrcDir(skillDir), manifastDir, ".manifast", report);
  }

  return report;
}
