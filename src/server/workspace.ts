import { readFile as fsReadFile, readdir, stat, open } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { confine, isConfined } from "./safePath";
import {
  WireframeSchema,
  TasksFileSchema,
  PlanFileSchema,
  DOC_TYPES as DOC_TYPE_VALUES,
  DocFrontmatterSchema,
  ManifestSchema,
  DiagramFileSchema,
} from "../shared/schema/index";
import type {
  WorkspaceDTO,
  WireframeMeta,
  DocMeta,
  DocFreshness,
  TasksData,
  PlanData,
  DiagramMeta,
  FileResponse,
  Kind,
} from "../shared/types";

// All API paths are PROJECT-ROOT-relative, posix-style (e.g.
// ".manifast/wireframes/x.json", "docs/auth.md"), so docs can live outside
// .manifast/. Resolution is confined to the project root.

const DEFAULT_DOC_SOURCES = [
  ".manifast/prd",
  ".manifast/specs",
  "docs",
  "CLAUDE.md",
  "AGENTS.md",
  "README.md",
];
const ALWAYS_EXCLUDE = ["node_modules", ".git", "dist", ".manifast/schema"];

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function dateToStr(d: Date): string {
  const iso = d.toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
}

function normalizeFrontmatter(value: unknown): unknown {
  if (value instanceof Date) return dateToStr(value);
  if (Array.isArray(value)) return value.map(normalizeFrontmatter);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = normalizeFrontmatter(v);
    return out;
  }
  return value;
}

function formatZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Invalid format";
  const where = issue.path.length ? issue.path.join(".") + ": " : "";
  return where + issue.message;
}

function parseJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: `JSON parse failed: ${(e as Error).message}` };
  }
}

async function listFiles(dir: string, ext: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(ext) && !e.name.startsWith("."))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function readText(file: string): Promise<string | null> {
  try {
    return await fsReadFile(file, "utf8");
  } catch {
    return null;
  }
}

// Read only the head of a file (enough for frontmatter + first H1) so listing
// many large docs (e.g. 173KB experiment logs) stays cheap.
async function readHead(file: string, maxBytes = 16384): Promise<string | null> {
  try {
    const fh = await open(file, "r");
    try {
      const buf = Buffer.alloc(maxBytes);
      const { bytesRead } = await fh.read(buf, 0, maxBytes, 0);
      return buf.subarray(0, bytesRead).toString("utf8");
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
}

// Cache doc meta by absolute path, invalidated by mtime+size — keeps repeated
// /api/workspace calls (every live-reload) fast even with many/large docs.
const docMetaCache = new Map<string, { mtimeMs: number; size: number; meta: DocMeta }>();

function fileBase(file: string): string {
  return path.basename(file).replace(/\.[^.]+$/, "");
}

function within(root: string, target: string): boolean {
  const r = path.resolve(root);
  const t = path.resolve(target);
  return t === r || t.startsWith(r + path.sep);
}

export function classifyPath(relPath: string): Kind {
  const p = toPosix(relPath);
  if (p === ".manifast/manifast.json") return "manifest";
  if (p === ".manifast/tasks/tasks.json") return "tasks";
  if (p === ".manifast/plan/plan.json") return "plan";
  if (p.startsWith(".manifast/wireframes/") && p.endsWith(".json")) return "wireframe";
  if (p.startsWith(".manifast/diagrams/") && p.endsWith(".json")) return "diagram";
  if (p.endsWith(".md")) return "doc";
  return "other";
}

// --- Manifest / config -----------------------------------------------------

interface ManifestConfig {
  project: { name: string; description?: string };
  sources?: { docs?: string[]; exclude?: string[] };
}

async function readManifest(manifastDir: string, projectDir: string): Promise<ManifestConfig> {
  const file = path.join(manifastDir, "manifast.json");
  // If `.manifast` itself is a junction/symlink escaping the root, don't read
  // (or leak the project name from) an external manifest — fall back to default.
  if (isConfined(projectDir, file)) {
    const raw = await readText(file);
    if (raw != null) {
      const parsed = parseJson(raw);
      if (parsed.ok) {
        const result = ManifestSchema.safeParse(parsed.value);
        if (result.success) return { project: result.data.project, sources: result.data.sources };
      }
    }
  }
  return { project: { name: path.basename(projectDir) || "manifast" } };
}

// --- Wireframe -------------------------------------------------------------

async function readWireframeMeta(manifastDir: string, file: string): Promise<WireframeMeta> {
  const rel = `.manifast/wireframes/${file}`;
  const fb = fileBase(file);
  const raw = await readText(path.join(manifastDir, "wireframes", file));
  if (raw == null) return { path: rel, id: fb, name: fb, device: "desktop", ok: false, error: "Cannot read file" };
  const parsed = parseJson(raw);
  if (!parsed.ok) return { path: rel, id: fb, name: fb, device: "desktop", ok: false, error: parsed.error };
  const result = WireframeSchema.safeParse(parsed.value);
  if (!result.success) {
    const v = parsed.value as Record<string, unknown>;
    return {
      path: rel,
      id: typeof v?.id === "string" ? v.id : fb,
      name: typeof v?.name === "string" ? v.name : fb,
      device: typeof v?.device === "string" ? v.device : "desktop",
      ok: false,
      error: formatZodError(result.error),
    };
  }
  return { path: rel, id: result.data.id, name: result.data.name, device: result.data.device, ok: true };
}

// --- Docs (multi-source, lenient) -----------------------------------------

function isExcluded(rel: string, excludes: string[]): boolean {
  const p = toPosix(rel);
  const segs = p.split("/");
  for (const ex of excludes) {
    const e = toPosix(ex).replace(/\/+$/, "");
    if (!e) continue;
    if (p === e || p.startsWith(e + "/")) return true;
    if (segs.includes(e)) return true;
  }
  return false;
}

async function walkMd(dir: string, projectDir: string, excludes: string[], out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const abs = path.join(dir, e.name);
    const rel = toPosix(path.relative(projectDir, abs));
    if (isExcluded(rel, excludes)) continue;
    if (e.isDirectory()) await walkMd(abs, projectDir, excludes, out);
    else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) out.push(rel);
  }
}

/** Strip fenced code blocks + inline code so `# comments` / sample links don't count. */
function stripCode(markdown: string): string {
  return markdown.replace(/```[\s\S]*?(?:```|$)/g, "").replace(/`[^`\n]*`/g, "");
}

function firstH1(markdown: string): string | undefined {
  const m = stripCode(markdown).match(/^\s{0,3}#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : undefined;
}

/**
 * Markdown-body links to other local .md files, resolved to project-root-relative
 * paths. This is how real docs/ folders actually cross-reference — without it a
 * densely linked docs tree renders as 100% orphans on the project map. Reads the
 * same 16KB head the rest of doc-meta uses; links past that are out of scope.
 */
function extractBodyLinks(body: string, rel: string): string[] | undefined {
  const cleaned = stripCode(body);
  const out = new Set<string>();
  const dir = path.posix.dirname(toPosix(rel));
  const re = /\[[^\]]*\]\(<?([^)\s>]+?)>?(?:\s+"[^"]*")?\)/g;
  for (const m of cleaned.matchAll(re)) {
    let target = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue; // http:, mailto:, …
    if (target.startsWith("#")) continue; // in-page anchor
    const hash = target.indexOf("#");
    if (hash >= 0) target = target.slice(0, hash);
    try {
      target = decodeURI(target);
    } catch {
      /* keep raw */
    }
    if (!/\.(md|markdown)$/i.test(target)) continue;
    const resolved = target.startsWith("/")
      ? path.posix.normalize(target.slice(1))
      : path.posix.normalize(path.posix.join(dir === "." ? "" : dir, target));
    if (!resolved || resolved.startsWith("..")) continue; // escapes project root
    if (resolved === toPosix(rel)) continue; // self-link
    out.add(resolved);
  }
  return out.size ? [...out] : undefined;
}

const DOC_TYPES = new Set<string>(DOC_TYPE_VALUES);

function inferDocType(rel: string, fm: Record<string, unknown>): DocMeta["type"] {
  const t = fm.type;
  if (typeof t === "string" && DOC_TYPES.has(t)) return t as DocMeta["type"];
  const p = toPosix(rel).toLowerCase();
  if (/(^|\/)adr(\/|$)/.test(p)) return "adr";
  if (/(^|\/)architecture(\/|$)/.test(p)) return "architecture";
  if (/(^|\/)prd(\/|\.|$)/.test(p)) return "prd";
  if (/(^|\/)spec/.test(p)) return "spec";
  return "doc";
}

function pathArchived(rel: string): boolean {
  return /(^|\/)archived?(\/|$)/i.test(toPosix(rel));
}

function slugFromPath(rel: string): string {
  return (
    toPosix(rel)
      .replace(/\.md$/i, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "doc"
  );
}

const STATUS_SET = new Set(["draft", "active", "done", "deprecated", "archived"]);

async function readDocMetaAt(projectDir: string, rel: string): Promise<DocMeta> {
  const abs = path.join(projectDir, rel);
  const st = await stat(abs).catch(() => null);
  let meta: DocMeta;
  if (st) {
    const c = docMetaCache.get(abs);
    if (c && c.mtimeMs === st.mtimeMs && c.size === st.size) meta = c.meta;
    else {
      meta = await computeDocMeta(rel, abs, st);
      docMetaCache.set(abs, { mtimeMs: st.mtimeMs, size: st.size, meta });
    }
  } else {
    meta = await computeDocMeta(rel, abs, st);
  }
  // Freshness depends on EXTERNAL `sources` files, so it's recomputed per call
  // rather than baked into the doc-mtime cache (see DESIGN 부록 D.3).
  const freshness = await computeFreshness(projectDir, meta);
  return freshness ? { ...meta, freshness } : meta;
}

// AI-free staleness signal: a doc is stale if any `sources` file is newer than
// its review baseline (lastReviewed → updatedAt), or its review TTL has elapsed.
// Frozen states (deprecated/archived) aren't scored. The agent does the deep
// (AST) drift judgement — the app only compares mtimes.
async function computeFreshness(projectDir: string, meta: DocMeta): Promise<DocFreshness | undefined> {
  if (meta.status === "archived" || meta.status === "deprecated") return undefined;
  const hasSignals = (meta.sources && meta.sources.length > 0) || meta.reviewBy != null;
  if (!hasSignals) return undefined;
  const baseline = meta.lastReviewed ?? meta.updatedAt;
  const baseMs = baseline ? Date.parse(baseline) : NaN;
  if (Number.isNaN(baseMs)) return undefined;
  const reasons: string[] = [];
  let stale = false;
  // Compare at day granularity so a same-day review clears a same-day code edit.
  const dayMs = 86_400_000;
  const baseDay = Math.floor(baseMs / dayMs);
  if (meta.sources) {
    for (const s of meta.sources) {
      const sAbs = path.resolve(projectDir, s);
      if (!within(projectDir, sAbs)) continue;
      const sst = await stat(sAbs).catch(() => null);
      if (sst && Math.floor(sst.mtimeMs / dayMs) > baseDay) {
        stale = true;
        reasons.push(`${s} changed`);
      }
    }
  }
  if (meta.reviewBy != null) {
    const ageDays = (Date.now() - baseMs) / 86_400_000;
    if (ageDays > meta.reviewBy) {
      stale = true;
      reasons.push(`Review overdue (${Math.floor(ageDays)}d > ${meta.reviewBy}d)`);
    }
  }
  return { stale, score: stale ? 0 : 100, reason: reasons.join("; ") || undefined };
}

async function computeDocMeta(rel: string, abs: string, st: Stats | null): Promise<DocMeta> {
  const source: DocMeta["source"] = toPosix(rel).startsWith(".manifast/") ? "manifast" : "external";
  // Filesystem fallback dates are shown date-only to stay readable.
  const fsCreated = st ? st.birthtime.toISOString().slice(0, 10) : undefined;
  const fsUpdated = st ? st.mtime.toISOString().slice(0, 10) : undefined;
  const raw = await readHead(abs);
  if (raw == null) {
    return { path: rel, id: slugFromPath(rel), type: "doc", title: fileBase(rel), status: "none", source, ok: false, error: "Cannot read file" };
  }

  let fm: Record<string, unknown> = {};
  let body = raw;
  let yamlWarning: string | undefined;
  try {
    const g = matter(raw);
    fm = normalizeFrontmatter(g.data ?? {}) as Record<string, unknown>;
    body = g.content;
  } catch (e) {
    yamlWarning = `frontmatter YAML parse failed: ${(e as Error).message}`;
  }

  const type = inferDocType(rel, fm);
  const isNative = fm.schema === "manifast.doc/1";

  const bodyLinks = extractBodyLinks(body, rel);

  // Native, schema-valid docs use the strict contract.
  if (isNative && !yamlWarning) {
    const parsed = DocFrontmatterSchema.safeParse(fm);
    if (parsed.success) {
      const d = parsed.data;
      return {
        path: rel,
        uid: d.uid,
        id: d.id,
        type: d.type,
        title: d.title,
        status: pathArchived(rel) ? "archived" : d.status,
        source,
        wireframe: d.wireframe,
        tasks: d.tasks,
        related: d.related,
        links: bodyLinks,
        owner: d.owner,
        lastReviewed: d.lastReviewed,
        reviewBy: d.reviewBy,
        sources: d.sources,
        critical: d.critical,
        createdAt: d.createdAt ?? fsCreated,
        updatedAt: d.updatedAt ?? fsUpdated,
        deprecatedAt: d.deprecatedAt,
        archivedAt: d.archivedAt,
        deprecatedBy: d.deprecatedBy,
        ok: true,
      };
    }
    // Native but invalid → render with a warning, best-effort fields.
    return { ...bestEffort(fm, rel, source, body, fsCreated, fsUpdated, type, bodyLinks), ok: true, warning: formatZodError(parsed.error) };
  }

  // External / found docs (no manifast schema) → lenient, no schema warning.
  return { ...bestEffort(fm, rel, source, body, fsCreated, fsUpdated, type, bodyLinks), ok: true, warning: yamlWarning };
}

function bestEffort(
  fm: Record<string, unknown>,
  rel: string,
  source: DocMeta["source"],
  body: string,
  fsCreated: string | undefined,
  fsUpdated: string | undefined,
  type: DocMeta["type"],
  links: string[] | undefined,
): DocMeta {
  const fmStatus = typeof fm.status === "string" && STATUS_SET.has(fm.status) ? fm.status : undefined;
  const status = fmStatus ?? (pathArchived(rel) ? "archived" : source === "manifast" ? "draft" : "none");
  return {
    path: rel,
    uid: typeof fm.uid === "string" ? fm.uid : undefined,
    id: typeof fm.id === "string" ? fm.id : slugFromPath(rel),
    type,
    title: typeof fm.title === "string" ? fm.title : firstH1(body) ?? fileBase(rel),
    status,
    source,
    wireframe: typeof fm.wireframe === "string" ? fm.wireframe : undefined,
    tasks: Array.isArray(fm.tasks) ? fm.tasks.filter((x): x is string => typeof x === "string") : undefined,
    related: Array.isArray(fm.related) ? fm.related.filter((x): x is string => typeof x === "string") : undefined,
    links,
    owner: typeof fm.owner === "string" ? fm.owner : undefined,
    lastReviewed: typeof fm.lastReviewed === "string" ? fm.lastReviewed : undefined,
    reviewBy: typeof fm.reviewBy === "number" ? fm.reviewBy : undefined,
    sources: Array.isArray(fm.sources)
      ? fm.sources.filter((x): x is string => typeof x === "string")
      : undefined,
    critical: typeof fm.critical === "boolean" ? fm.critical : undefined,
    createdAt: typeof fm.createdAt === "string" ? fm.createdAt : fsCreated,
    updatedAt: typeof fm.updatedAt === "string" ? fm.updatedAt : fsUpdated,
    deprecatedAt: typeof fm.deprecatedAt === "string" ? fm.deprecatedAt : undefined,
    archivedAt: typeof fm.archivedAt === "string" ? fm.archivedAt : undefined,
    deprecatedBy: typeof fm.deprecatedBy === "string" ? fm.deprecatedBy : undefined,
    ok: true,
  };
}

async function discoverDocs(projectDir: string, sources: ManifestConfig["sources"]): Promise<DocMeta[]> {
  const entries = sources?.docs ?? DEFAULT_DOC_SOURCES;
  const excludes = [...ALWAYS_EXCLUDE, ...(sources?.exclude ?? [])];
  const relSet = new Set<string>();

  for (const entry of entries) {
    const abs = path.resolve(projectDir, entry);
    if (!within(projectDir, abs)) continue;
    const st = await stat(abs).catch(() => null);
    if (!st) continue;
    if (st.isFile()) {
      if (abs.toLowerCase().endsWith(".md")) relSet.add(toPosix(path.relative(projectDir, abs)));
    } else if (st.isDirectory()) {
      const out: string[] = [];
      await walkMd(abs, projectDir, excludes, out);
      for (const r of out) relSet.add(r);
    }
  }

  const rels = [...relSet].sort((a, b) => a.localeCompare(b));
  return Promise.all(rels.map((r) => readDocMetaAt(projectDir, r)));
}

/**
 * Watch targets beyond .manifast/: directory sources (chokidar, recursive) and
 * individual file sources (fs.watch, non-recursive). File sources are kept out
 * of chokidar because a root-level file (CLAUDE.md…) would make chokidar watch
 * the whole repo recursively.
 */
export async function resolveWatchRoots(
  manifastDir: string,
  projectDir: string,
): Promise<{ dirs: string[]; files: string[] }> {
  const { sources } = await readManifest(manifastDir, projectDir);
  const entries = sources?.docs ?? DEFAULT_DOC_SOURCES;
  // Only watch roots that stay inside the project root once symlinks/junctions
  // are resolved — otherwise a `.manifast` (or source dir) junction would make
  // the watcher follow it and broadcast outside file changes over the WS.
  const dirs = new Set<string>();
  if (isConfined(projectDir, manifastDir)) dirs.add(manifastDir);
  const files = new Set<string>();
  for (const entry of entries) {
    const abs = path.resolve(projectDir, entry);
    if (!within(projectDir, abs)) continue;
    if (within(manifastDir, abs)) continue; // already covered
    if (!isConfined(projectDir, abs)) continue;
    const st = await stat(abs).catch(() => null);
    if (st?.isDirectory()) dirs.add(abs);
    else if (st?.isFile()) files.add(abs);
  }
  return { dirs: [...dirs], files: [...files] };
}

// --- Tasks / Plan ----------------------------------------------------------

async function readTasks(manifastDir: string): Promise<TasksData | null> {
  const rel = ".manifast/tasks/tasks.json";
  const raw = await readText(path.join(manifastDir, "tasks", "tasks.json"));
  if (raw == null) return null;
  const parsed = parseJson(raw);
  if (!parsed.ok) return { path: rel, tasks: [], ok: false, error: parsed.error };
  const result = TasksFileSchema.safeParse(parsed.value);
  if (!result.success) return { path: rel, tasks: [], ok: false, error: formatZodError(result.error) };
  return { path: rel, tasks: result.data.tasks, ok: true };
}

async function readPlan(manifastDir: string): Promise<PlanData | null> {
  const rel = ".manifast/plan/plan.json";
  const raw = await readText(path.join(manifastDir, "plan", "plan.json"));
  if (raw == null) return null;
  const parsed = parseJson(raw);
  if (!parsed.ok) return { path: rel, phases: [], ok: false, error: parsed.error };
  const result = PlanFileSchema.safeParse(parsed.value);
  if (!result.success) return { path: rel, phases: [], ok: false, error: formatZodError(result.error) };
  return { path: rel, phases: result.data.phases, ok: true };
}

// --- Diagrams --------------------------------------------------------------

async function readDiagramMeta(manifastDir: string, file: string): Promise<DiagramMeta> {
  const rel = `.manifast/diagrams/${file}`;
  const fb = fileBase(file);
  const raw = await readText(path.join(manifastDir, "diagrams", file));
  const empty = { path: rel, id: fb, title: fb, kind: "diagram", nodeCount: 0, edgeCount: 0 };
  if (raw == null) return { ...empty, ok: false, error: "Cannot read file" };
  const parsed = parseJson(raw);
  if (!parsed.ok) return { ...empty, ok: false, error: parsed.error };
  const r = DiagramFileSchema.safeParse(parsed.value);
  if (!r.success) {
    const v = parsed.value as Record<string, unknown>;
    return {
      path: rel,
      id: typeof v?.id === "string" ? v.id : fb,
      title: typeof v?.title === "string" ? v.title : fb,
      kind: typeof v?.kind === "string" ? v.kind : "diagram",
      nodeCount: Array.isArray(v?.nodes) ? v.nodes.length : 0,
      edgeCount: Array.isArray(v?.edges) ? v.edges.length : 0,
      ok: false,
      error: formatZodError(r.error),
    };
  }
  return {
    path: rel,
    id: r.data.id,
    title: r.data.title,
    kind: r.data.kind,
    nodeCount: r.data.nodes.length,
    edgeCount: r.data.edges.length,
    ok: true,
  };
}

// --- Public: full workspace snapshot --------------------------------------

export async function readWorkspace(manifastDir: string, projectDir: string): Promise<WorkspaceDTO> {
  const config = await readManifest(manifastDir, projectDir);
  const wfDir = path.join(manifastDir, "wireframes");
  const diagDir = path.join(manifastDir, "diagrams");
  // Drop anything that escapes the project root once symlinks/junctions are
  // resolved, so a junction at a source dir can't leak outside files (or their
  // id/title metadata) into the workspace snapshot.
  const [wfFiles, diagFiles, docs, tasksRaw, planRaw] = await Promise.all([
    listFiles(wfDir, ".json").then((fs) => fs.filter((f) => isConfined(projectDir, path.join(wfDir, f)))),
    listFiles(diagDir, ".json").then((fs) => fs.filter((f) => isConfined(projectDir, path.join(diagDir, f)))),
    discoverDocs(projectDir, config.sources).then((ds) =>
      ds.filter((d) => isConfined(projectDir, path.join(projectDir, d.path))),
    ),
    readTasks(manifastDir),
    readPlan(manifastDir),
  ]);
  const tasks = tasksRaw && isConfined(projectDir, path.join(manifastDir, "tasks")) ? tasksRaw : null;
  const plan = planRaw && isConfined(projectDir, path.join(manifastDir, "plan")) ? planRaw : null;

  const [wireframes, diagrams] = await Promise.all([
    Promise.all(wfFiles.map((f) => readWireframeMeta(manifastDir, f))),
    Promise.all(diagFiles.map((f) => readDiagramMeta(manifastDir, f))),
  ]);

  const errors: { path: string; error: string }[] = [];
  for (const w of wireframes) if (!w.ok && w.error) errors.push({ path: w.path, error: w.error });
  for (const d of docs) {
    if (!d.ok && d.error) errors.push({ path: d.path, error: d.error });
    else if (d.warning) errors.push({ path: d.path, error: d.warning });
  }
  for (const g of diagrams) if (!g.ok && g.error) errors.push({ path: g.path, error: g.error });
  if (tasks && !tasks.ok && tasks.error) errors.push({ path: tasks.path, error: tasks.error });
  if (plan && !plan.ok && plan.error) errors.push({ path: plan.path, error: plan.error });

  return {
    project: config.project,
    items: { wireframes, docs, tasks, plan, diagrams },
    errors,
  };
}

// --- Public: single file (full content) -----------------------------------

function resolveSafe(projectDir: string, relPath: string): string | null {
  // `confine` resolves symlinks so a link inside the workspace can't read
  // outside it (a plain prefix check on path.resolve() would miss that).
  return confine(projectDir, relPath);
}

export async function readFileResource(projectDir: string, relPath: string): Promise<FileResponse> {
  const kind = classifyPath(relPath);
  const abs = resolveSafe(projectDir, relPath);
  if (!abs) {
    if (kind === "doc") return { kind, path: relPath, frontmatter: null, markdown: "", ok: false, error: "Invalid path" };
    return { kind: kind === "tasks" || kind === "plan" || kind === "diagram" ? kind : "wireframe", path: relPath, data: null, ok: false, error: "Invalid path" } as FileResponse;
  }
  const raw = await readText(abs);

  if (kind === "doc") {
    if (raw == null) return { kind, path: relPath, frontmatter: null, markdown: "", ok: false, error: "Cannot read file" };
    try {
      const g = matter(raw);
      const fm = normalizeFrontmatter(g.data ?? {}) as Record<string, unknown>;
      const result = DocFrontmatterSchema.safeParse(fm);
      const nativeWarning = fm.schema === "manifast.doc/1" && !result.success ? formatZodError(result.error) : undefined;
      return { kind, path: relPath, frontmatter: fm, markdown: g.content, ok: true, warning: nativeWarning };
    } catch (e) {
      return { kind, path: relPath, frontmatter: {}, markdown: raw, ok: true, warning: `frontmatter YAML parse failed: ${(e as Error).message}` };
    }
  }

  if (raw == null) {
    return { kind: kind === "tasks" || kind === "plan" || kind === "diagram" ? kind : "wireframe", path: relPath, data: null, ok: false, error: "Cannot read file" } as FileResponse;
  }
  const parsed = parseJson(raw);
  if (!parsed.ok) {
    return { kind: kind === "tasks" || kind === "plan" || kind === "diagram" ? kind : "wireframe", path: relPath, data: null, ok: false, error: parsed.error } as FileResponse;
  }

  if (kind === "tasks") {
    const r = TasksFileSchema.safeParse(parsed.value);
    return r.success ? { kind, path: relPath, data: r.data, ok: true } : { kind, path: relPath, data: null, ok: false, error: formatZodError(r.error) };
  }
  if (kind === "plan") {
    const r = PlanFileSchema.safeParse(parsed.value);
    return r.success ? { kind, path: relPath, data: r.data, ok: true } : { kind, path: relPath, data: null, ok: false, error: formatZodError(r.error) };
  }
  if (kind === "diagram") {
    const r = DiagramFileSchema.safeParse(parsed.value);
    return r.success ? { kind, path: relPath, data: r.data, ok: true } : { kind, path: relPath, data: null, ok: false, error: formatZodError(r.error) };
  }
  const r = WireframeSchema.safeParse(parsed.value);
  return r.success
    ? { kind: "wireframe", path: relPath, data: r.data, ok: true }
    : { kind: "wireframe", path: relPath, data: null, ok: false, error: formatZodError(r.error) };
}

export async function validatePath(projectDir: string, relPath: string): Promise<{ ok: boolean; error?: string }> {
  const kind = classifyPath(relPath);
  if (kind === "doc" || kind === "other") return { ok: true };
  const res = await readFileResource(projectDir, relPath);
  return { ok: res.ok, error: res.error };
}

/** All files under .manifast/ (project-root-relative, posix) for the ZIP export. */
export async function listAllFiles(manifastDir: string, projectDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const abs = path.join(dir, e.name);
      // Skip anything that escapes the project root once symlinks/junctions are
      // resolved, so a `.manifast` (or sub-dir) junction can't leak outside file
      // names — or send us walking an external tree — via the export listing.
      if (!isConfined(projectDir, abs)) continue;
      if (e.isDirectory()) await walk(abs);
      else if (e.isFile()) out.push(toPosix(path.relative(projectDir, abs)));
    }
  }
  try {
    await stat(manifastDir);
  } catch {
    return out;
  }
  await walk(manifastDir);
  return out.sort((a, b) => a.localeCompare(b));
}
