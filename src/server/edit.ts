import { readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import matter from "gray-matter";
import { confine } from "./safePath";

// The ONLY place the app writes user docs. Writes are limited to frontmatter
// keys (uid + lifecycle metadata); the markdown body is never modified.

function resolveDoc(projectDir: string, rel: string): string | null {
  if (!rel || !rel.toLowerCase().endsWith(".md")) return null;
  // confine follows symlinks so a link inside the workspace can't redirect a
  // frontmatter write to a file outside it.
  return confine(projectDir, rel);
}

function genUid(): string {
  return crypto.randomBytes(6).toString("base64url"); // ~8 url-safe chars
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type FmValue = string | number | boolean | string[];

function yamlScalar(v: string): string {
  return /^[A-Za-z0-9_./-]+$/.test(v) ? v : JSON.stringify(v);
}

// Serialize a scalar, number, boolean, or string[] (inline flow array) to YAML.
function yamlValue(v: FmValue): string {
  if (Array.isArray(v)) return `[${v.map(yamlScalar).join(", ")}]`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return yamlScalar(v);
}

/**
 * Insert/update frontmatter keys without reformatting the rest of the file.
 * Preserves the markdown body exactly. Creates a frontmatter block if absent.
 */
function setFrontmatterKeys(raw: string, updates: Record<string, FmValue>): string {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/);
  if (!m) {
    const lines = Object.entries(updates)
      .map(([k, v]) => `${k}: ${yamlValue(v)}`)
      .join("\n");
    return `---\n${lines}\n---\n\n${raw}`;
  }
  let block = m[1];
  for (const [k, v] of Object.entries(updates)) {
    const line = `${k}: ${yamlValue(v)}`;
    const re = new RegExp(`^${k}[ \\t]*:.*$`, "m");
    if (re.test(block)) block = block.replace(re, line);
    else block = block.replace(/\s*$/, "") + "\n" + line;
  }
  const body = raw.slice(m[0].length);
  return `---\n${block}\n---\n${body}`;
}

export interface AdoptResult {
  ok: boolean;
  uid?: string;
  error?: string;
}

/** Stamp a random, stable uid into a doc's frontmatter (idempotent). */
export async function adoptDoc(projectDir: string, rel: string): Promise<AdoptResult> {
  const abs = resolveDoc(projectDir, rel);
  if (!abs) return { ok: false, error: "유효하지 않은 문서 경로" };
  let raw: string;
  try {
    raw = await readFile(abs, "utf8");
  } catch {
    return { ok: false, error: "파일을 읽을 수 없음" };
  }
  let existing: unknown;
  try {
    existing = matter(raw).data?.uid;
  } catch {
    existing = undefined;
  }
  if (typeof existing === "string" && existing.length > 0) {
    return { ok: true, uid: existing }; // already adopted
  }
  const uid = genUid();
  try {
    await writeFile(abs, setFrontmatterKeys(raw, { uid }), "utf8");
  } catch (e) {
    return { ok: false, error: `쓰기 실패: ${(e as Error).message}` };
  }
  return { ok: true, uid };
}

const STATUS_SET = new Set(["draft", "active", "done", "deprecated", "archived"]);

export interface StatusResult {
  ok: boolean;
  error?: string;
}

/** Set a doc's lifecycle status (+ stamps the relevant date / successor). */
export async function setDocStatus(
  projectDir: string,
  rel: string,
  status: string,
  deprecatedBy?: string,
): Promise<StatusResult> {
  if (!STATUS_SET.has(status)) return { ok: false, error: `알 수 없는 상태: ${status}` };
  const abs = resolveDoc(projectDir, rel);
  if (!abs) return { ok: false, error: "유효하지 않은 문서 경로" };
  let raw: string;
  try {
    raw = await readFile(abs, "utf8");
  } catch {
    return { ok: false, error: "파일을 읽을 수 없음" };
  }
  const updates: Record<string, string> = { status, updatedAt: today() };
  if (status === "deprecated") {
    updates.deprecatedAt = today();
    if (deprecatedBy) updates.deprecatedBy = deprecatedBy;
  }
  if (status === "archived") updates.archivedAt = today();
  try {
    await writeFile(abs, setFrontmatterKeys(raw, updates), "utf8");
  } catch (e) {
    return { ok: false, error: `쓰기 실패: ${(e as Error).message}` };
  }
  return { ok: true };
}

export interface ReviewResult {
  ok: boolean;
  error?: string;
}

/**
 * Record review metadata (owner / lastReviewed / reviewBy). Re-blessing a doc:
 * stamps lastReviewed (today by default) so freshness clears. Body untouched.
 */
export async function setDocReview(
  projectDir: string,
  rel: string,
  fields: { owner?: string; lastReviewed?: string; reviewBy?: number },
): Promise<ReviewResult> {
  const abs = resolveDoc(projectDir, rel);
  if (!abs) return { ok: false, error: "유효하지 않은 문서 경로" };
  let raw: string;
  try {
    raw = await readFile(abs, "utf8");
  } catch {
    return { ok: false, error: "파일을 읽을 수 없음" };
  }
  const updates: Record<string, FmValue> = {
    lastReviewed:
      fields.lastReviewed && /^\d{4}-\d{2}-\d{2}$/.test(fields.lastReviewed)
        ? fields.lastReviewed
        : today(),
  };
  if (typeof fields.owner === "string" && fields.owner.trim()) updates.owner = fields.owner.trim();
  if (typeof fields.reviewBy === "number" && Number.isFinite(fields.reviewBy))
    updates.reviewBy = Math.max(0, Math.floor(fields.reviewBy));
  try {
    await writeFile(abs, setFrontmatterKeys(raw, updates), "utf8");
  } catch (e) {
    return { ok: false, error: `쓰기 실패: ${(e as Error).message}` };
  }
  return { ok: true };
}
