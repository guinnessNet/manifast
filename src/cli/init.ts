import { mkdir, readdir, access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface InitReport {
  created: string[];
  updated: string[];
  skipped: string[];
}

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
    "<!-- 이 블록은 `manifast init`이 관리합니다. 마커 밖만 자유롭게 수정하세요. -->",
    "## Manifast — 문서 작성 규칙",
    "",
    "이 프로젝트의 **기획·설계 산출물**(와이어프레임 · PRD/스펙 · 태스크 보드 · 로드맵 ·",
    "아키텍처/문서맵 다이어그램 · 구조화 문서)은 **Manifast 스킬 규칙으로만** 작성·갱신한다.",
    "",
    "- **모든 에이전트(Claude · Codex · 그 외)**는 만들거나 고치기 전에 `.manifast/AGENTS.md`",
    "  (전체 작성 가이드 + 스키마·절차)를 먼저 읽고 그 규칙을 따른다. 임의 형식으로 손대지 말 것.",
    "  (Claude Code는 `.claude/skills/manifast/SKILL.md`도 자동 로드한다.)",
    "- 새 기획 문서는 `.manifast/`(또는 추적 대상 `docs/`)에 규칙대로 둔다.",
    "- 문서가 기술하는 코드(frontmatter `sources`)가 바뀌면 같은 변경에서 문서도 갱신한다.",
    "- 작성/수정 후 `npx manifast validate`로 검증한다. 에러가 있으면 통과한 게 아니다.",
    "- 일반 코드/README 잡수정까지 이 규칙을 강제하진 않는다.",
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
): Promise<InitReport> {
  const report: InitReport = { created: [], updated: [], skipped: [] };

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

  return report;
}
