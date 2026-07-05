import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  LayoutGrid,
  KanbanSquare,
  ChevronDown,
  ChevronRight,
  Check,
  Hash,
  Plus,
  AlertTriangle,
  RefreshCw,
  FileCode,
  Clock,
  FileText,
  Folder,
  FolderOpen,
  Search,
  Archive,
} from "lucide-react";
import type { DocMeta } from "@shared/types";
import type { LinkGraph } from "../../lib/links";
import { useFile } from "../../hooks/useFile";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ErrorBanner } from "../ErrorBanner";
import { LinkChip } from "../LinkChip";
import { DocExportMenu } from "../ExportMenu";
import { useNavigate } from "../../lib/nav";
import { WireframeThumb } from "../wireframe/WireframeThumb";
import { adoptDoc, setDocStatus, setDocReview, rawUrl } from "../../lib/api";
import { buildDocTree, allFolderPaths, folderLabel, type DocTreeFolder } from "../../lib/docTree";
import { cn } from "../../lib/cn";

/** Browser-side posix normalize ("docs/a/../b.md" → "docs/b.md"); "" if it escapes root. */
function normalizePath(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (parts.length === 0) return "";
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join("/");
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

/** Resolve a markdown-relative href/src against the current doc's folder. */
function resolveRelative(target: string, docPath?: string): string | undefined {
  if (!docPath || !target || SCHEME_RE.test(target) || target.startsWith("#")) return undefined;
  let clean = target.split("#")[0];
  if (!clean) return undefined;
  // Match the server's extractBodyLinks: percent-encoded local paths
  // ("./%ED%95%9C%EA%B8%80.md") must resolve to the same doc path.
  try {
    clean = decodeURI(clean);
  } catch {
    /* keep raw */
  }
  const dir = docPath.includes("/") ? docPath.slice(0, docPath.lastIndexOf("/")) : "";
  return normalizePath(clean.startsWith("/") ? clean.slice(1) : dir ? `${dir}/${clean}` : clean) || undefined;
}

const STATUSES = ["draft", "active", "done", "deprecated", "archived"];
const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning"> = {
  draft: "neutral",
  active: "info",
  done: "success",
  deprecated: "warning",
  archived: "neutral",
  none: "neutral",
};
// dot color in the left rail, by status
const STATUS_DOT: Record<string, string> = {
  active: "var(--accent)",
  done: "var(--ok)",
  deprecated: "var(--warn)",
  archived: "var(--text-faint)",
  draft: "var(--text-faint)",
};

function typeLabel(t: string): string {
  const m: Record<string, string> = {
    prd: "PRD",
    spec: "SPEC",
    doc: "DOC",
    adr: "ADR",
    architecture: "ARCH",
    tutorial: "TUTORIAL",
    howto: "HOW-TO",
    reference: "REFERENCE",
    explanation: "EXPLAIN",
  };
  return m[t] ?? t.toUpperCase();
}

export interface DocViewProps {
  docs: DocMeta[];
  path?: string;
  onSelect: (path: string) => void;
  meta?: DocMeta;
  graph: LinkGraph;
  tick: number;
}

export function DocView({ docs, path, onSelect, meta, graph, tick }: DocViewProps) {
  const { file, loading } = useFile(path, tick);
  const docRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const doc = file && file.kind === "doc" ? file : null;
  const warning = doc?.warning ?? meta?.warning;
  const title = meta?.title ?? path;
  const type = meta?.type ?? "doc";
  const status = meta?.status ?? "draft";
  const muted = status === "deprecated" || status === "archived";

  const wfId = meta?.wireframe;
  const wfMeta = wfId ? graph.wireframeById(wfId) : undefined;
  const linkedTasks = meta ? graph.tasksForSpec(meta.id) : [];
  const brokenTaskIds = (meta?.tasks ?? []).filter((id) => !graph.hasTask(id));
  const successor = meta?.deprecatedBy;
  const relatedDocs = meta ? graph.relatedForDoc(meta.id).filter((d) => d.path !== meta.path) : [];
  const backlinks = meta
    ? graph.backlinksForDoc(meta.id).filter((d) => d.path !== meta.path && !relatedDocs.some((r) => r.path === d.path))
    : [];

  // Relative links navigate inside the SPA (no full reload) and relative images
  // load through /api/raw; everything else keeps default anchor behavior.
  const docPath = meta?.path;
  const mdComponents = useMemo(
    () => ({
      // `node` is react-markdown's hast node — strip it so it doesn't land in
      // the DOM (and exported HTML) as node="[object Object]".
      a: ({ node: _node, href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => {
        const resolved = resolveRelative(href ?? "", docPath);
        const targetDoc = resolved && /\.(md|markdown)$/i.test(resolved) ? docs.find((d) => d.path === resolved) : undefined;
        if (targetDoc) {
          return (
            <a
              {...props}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                navigate({ kind: "doc", id: targetDoc.id });
              }}
            >
              {children}
            </a>
          );
        }
        const external = !!href && SCHEME_RE.test(href);
        return (
          <a {...props} href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
            {children}
          </a>
        );
      },
      img: ({ node: _node, src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { node?: unknown }) => {
        const resolved = typeof src === "string" ? resolveRelative(src, docPath) : undefined;
        return <img {...props} alt={alt} src={resolved ? rawUrl(resolved) : src} />;
      },
    }),
    [docPath, docs, navigate],
  );

  return (
    <div className="flex h-full min-h-0">
      <DocRail docs={docs} selected={path} onSelect={onSelect} />

      <div className="min-w-0 flex-1 overflow-auto">
        {!path ? (
          <div className="grid h-full place-items-center text-sm text-[var(--text-faint)]">
            표시할 문서가 없습니다.
          </div>
        ) : (
          <div className="mx-auto max-w-[820px] px-10 pb-20 pt-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{typeLabel(type)}</Badge>
                  {path && <StatusControl path={path} status={status} />}
                  {meta?.freshness?.stale && (
                    <span
                      title={meta.freshness.reason}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--warn-border)] bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--warn)]"
                    >
                      <AlertTriangle size={11} /> stale
                    </span>
                  )}
                  {meta?.source === "external" && (
                    <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
                      external
                    </span>
                  )}
                  {meta?.createdAt && <span className="text-xs text-[var(--text-faint)]">created {meta.createdAt}</span>}
                  {meta?.updatedAt && <span className="text-xs text-[var(--text-faint)]">updated {meta.updatedAt}</span>}
                  {path && <AdoptControl path={path} uid={meta?.uid} />}
                  {path && <ReviewControl path={path} />}
                </div>

                <h2
                  className={cn(
                    "mt-3 truncate text-[28px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text)]",
                    muted && "text-[var(--text-faint)] line-through",
                  )}
                >
                  {title}
                </h2>

                {(wfId || linkedTasks.length > 0 || brokenTaskIds.length > 0 || successor) && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {successor && (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        →
                        <LinkChip target={{ kind: "doc", id: successor }} exists={graph.hasDoc(successor)} label={`후속: ${successor}`} />
                      </span>
                    )}
                    {wfId && (
                      <LinkChip
                        target={{ kind: "wireframe", id: wfId }}
                        exists={graph.hasWireframe(wfId)}
                        label={wfMeta?.name ?? wfId}
                        icon={<LayoutGrid size={11} />}
                      />
                    )}
                    {linkedTasks.map((t) => (
                      <LinkChip key={t.id} target={{ kind: "task", id: t.id }} exists label={t.title} icon={<KanbanSquare size={11} />} />
                    ))}
                    {brokenTaskIds.map((id) => (
                      <LinkChip key={id} target={{ kind: "task", id }} exists={false} label={id} icon={<KanbanSquare size={11} />} />
                    ))}
                  </div>
                )}

                {/* doc↔doc ties: what the agent wired (related/body links) + who points here */}
                {(relatedDocs.length > 0 || backlinks.length > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {relatedDocs.length > 0 && (
                      <span className="text-[11px] font-medium text-[var(--text-faint)]">관련</span>
                    )}
                    {relatedDocs.map((d) => (
                      <LinkChip key={d.path} target={{ kind: "doc", id: d.id }} exists label={d.title} icon={<FileText size={11} />} />
                    ))}
                    {backlinks.length > 0 && (
                      <span className="text-[11px] font-medium text-[var(--text-faint)]">← 참조됨</span>
                    )}
                    {backlinks.map((d) => (
                      <LinkChip key={d.path} target={{ kind: "doc", id: d.id }} exists label={d.title} icon={<FileText size={11} />} />
                    ))}
                  </div>
                )}

                {(meta?.owner || meta?.lastReviewed || (meta?.sources && meta.sources.length > 0)) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-soft)] pt-3 font-mono text-[11px] text-[var(--text-faint)]">
                    {(meta?.owner || meta?.lastReviewed) && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={11} />
                        Last reviewed
                        {meta?.owner ? ` by ${meta.owner}` : ""}
                        {meta?.lastReviewed ? ` on ${meta.lastReviewed}` : ""}
                        {meta?.reviewBy ? ` · every ${meta.reviewBy}d` : ""}
                      </span>
                    )}
                    {meta?.sources?.map((src) => (
                      <span key={src} className="inline-flex items-center gap-1" title="이 문서가 기술하는 코드">
                        <FileCode size={11} />
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <DocExportMenu docRef={docRef} path={path} name={meta?.id ?? "doc"} />
            </div>

            {warning && <ErrorBanner className="mt-3" kind="warning" path={path} message={`frontmatter: ${warning}`} />}

            <div className="mt-7">
              {!doc && <div className="text-sm text-[var(--text-faint)]">{loading ? "Loading…" : ""}</div>}
              {doc && (
                <div className="flex flex-col gap-5">
                  {wfMeta && (
                    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                      <WireframeThumb path={wfMeta.path} tick={tick} onClick={() => navigate({ kind: "wireframe", id: wfMeta.id })} />
                      <div className="text-xs text-[var(--text-muted)]">
                        <div className="font-medium text-[var(--text)]">연결된 화면</div>
                        <div>{wfMeta.name}</div>
                        <div className="text-[var(--text-faint)]">{wfMeta.device}</div>
                      </div>
                    </div>
                  )}
                  <div ref={docRef} className="mf-prose">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={mdComponents}>
                      {doc.markdown}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── left rail: search + collapsible folder tree + archived toggle ───────────
const COLLAPSE_KEY = "mf-docs-collapsed";

/** Collapsed-folder set, persisted across reloads (so the tree survives refresh + live reload). */
function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      // Validate: a bare JSON string is iterable and would seed a Set of single
      // chars; only accept an array of strings, else reset.
      if (Array.isArray(v)) return new Set(v.filter((x): x is string => typeof x === "string"));
    }
  } catch {
    /* ignore malformed/disabled storage */
  }
  return new Set();
}

const INDENT_PX = 14; // per-depth indentation step
const indentStyle = (depth: number) => ({ paddingLeft: 8 + depth * INDENT_PX });

function DocRail({
  docs,
  selected,
  onSelect,
}: {
  docs: DocMeta[];
  selected?: string;
  onSelect: (p: string) => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);

  // Every folder path that actually exists (built from ALL docs incl. archived,
  // independent of the search/archived filters) so we never drop a live folder.
  const knownFolders = useMemo(() => new Set(allFolderPaths(buildDocTree(docs))), [docs]);

  // Persist collapse state — survives a full page refresh; in-memory state already
  // survives live reload (DocView is not unmounted on a workspace change). Only
  // paths for folders that still exist are written, so storage self-prunes entries
  // for folders that were renamed/deleted.
  useEffect(() => {
    try {
      const live = [...collapsed].filter((p) => knownFolders.has(p));
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(live));
    } catch {
      /* ignore */
    }
  }, [collapsed, knownFolders]);

  const archivedCount = docs.filter((d) => d.status === "archived").length;
  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  const visible = useMemo(() => {
    let v = showArchived ? docs : docs.filter((d) => d.status !== "archived");
    if (query) {
      v = v.filter((d) => d.title.toLowerCase().includes(query) || d.path.toLowerCase().includes(query));
    }
    return v;
  }, [docs, showArchived, query]);

  const tree = useMemo(() => buildDocTree(visible), [visible]);
  const folderPaths = useMemo(() => allFolderPaths(tree), [tree]);

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  // While searching every folder auto-expands so matches are always visible.
  const isCollapsed = (path: string) => !searching && collapsed.has(path);

  return (
    <div className="flex w-[268px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="px-3.5 pb-2 pt-3.5">
        <div className="flex h-[34px] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5">
          <Search size={14} className="shrink-0 text-[var(--text-faint)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search docs… (${docs.length})`}
            className="w-full bg-transparent text-[12.5px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
          />
        </div>
      </div>

      {!searching && folderPaths.length > 0 && (
        <div className="flex items-center justify-end gap-0.5 px-3 pb-1.5">
          <button
            onClick={() => setCollapsed((prev) => new Set([...prev, ...folderPaths]))}
            title="모든 폴더 접기"
            className="rounded-md px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
          >
            모두 접기
          </button>
          <button
            onClick={() => setCollapsed(new Set())}
            title="모든 폴더 펼치기"
            className="rounded-md px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
          >
            모두 펼치기
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-1">
        {docs.length === 0 && <p className="px-2.5 py-3 text-xs text-[var(--text-faint)]">문서가 없습니다</p>}
        {tree.folders.map((child) => (
          <FolderNode
            key={child.path}
            folder={child}
            depth={0}
            selected={selected}
            onSelect={onSelect}
            isCollapsed={isCollapsed}
            onToggle={toggle}
            interactive={!searching}
          />
        ))}
        {tree.docs.map((d) => (
          <DocButton key={d.path} doc={d} depth={0} active={selected === d.path} onSelect={onSelect} />
        ))}
        {visible.length === 0 && docs.length > 0 && (
          <p className="px-2.5 py-3 text-xs text-[var(--text-faint)]">일치하는 문서가 없습니다</p>
        )}
      </div>

      {archivedCount > 0 && !query && (
        <div className="border-t border-[var(--border)] p-2">
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-[var(--text-faint)] hover:bg-[var(--accent-soft)]"
          >
            <Archive size={14} />
            {showArchived ? "아카이브 숨기기" : `아카이브 보기 (${archivedCount})`}
          </button>
        </div>
      )}
    </div>
  );
}

/** One collapsible folder row + (when expanded) its sub-folders and docs. */
function FolderNode({
  folder,
  depth,
  selected,
  onSelect,
  isCollapsed,
  onToggle,
  interactive,
}: {
  folder: DocTreeFolder;
  depth: number;
  selected?: string;
  onSelect: (p: string) => void;
  isCollapsed: (path: string) => boolean;
  onToggle: (path: string) => void;
  /** False during search: folders are force-expanded, so the row is a static
   * (non-toggleable) header — avoids a focusable control whose click would be a
   * no-op yet silently mutate the persisted collapse state. */
  interactive: boolean;
}) {
  const collapsed = isCollapsed(folder.path);
  const label = folderLabel(folder);
  const inner = (
    <>
      <ChevronRight
        size={13}
        className="shrink-0 text-[var(--text-faint)] transition-transform"
        style={{ transform: collapsed ? "none" : "rotate(90deg)" }}
      />
      {collapsed ? (
        <Folder size={13} className="shrink-0 text-[var(--text-muted)]" />
      ) : (
        <FolderOpen size={13} className="shrink-0 text-[var(--text-muted)]" />
      )}
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text-muted)]">{label}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">{folder.count}</span>
    </>
  );
  return (
    <div>
      {interactive ? (
        <button
          type="button"
          onClick={() => onToggle(folder.path)}
          aria-expanded={!collapsed}
          aria-label={`${label} 폴더, 문서 ${folder.count}개, ${collapsed ? "접힘" : "펼침"}`}
          title={folder.path}
          style={indentStyle(depth)}
          className="flex w-full items-center gap-1.5 rounded-lg py-[6px] pr-2.5 text-left transition-colors hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {inner}
        </button>
      ) : (
        <div
          title={folder.path}
          style={indentStyle(depth)}
          className="flex w-full items-center gap-1.5 py-[6px] pr-2.5 text-left"
        >
          {inner}
        </div>
      )}
      {!collapsed && (
        <div>
          {folder.folders.map((child) => (
            <FolderNode
              key={child.path}
              folder={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              isCollapsed={isCollapsed}
              onToggle={onToggle}
              interactive={interactive}
            />
          ))}
          {folder.docs.map((d) => (
            <DocButton key={d.path} doc={d} depth={depth + 1} active={selected === d.path} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A single doc leaf in the tree (icon · title · warning · status dot). */
function DocButton({
  doc,
  depth,
  active,
  onSelect,
}: {
  doc: DocMeta;
  depth: number;
  active: boolean;
  onSelect: (p: string) => void;
}) {
  const dim = doc.status === "deprecated" || doc.status === "archived";
  return (
    <button
      onClick={() => onSelect(doc.path)}
      title={doc.path}
      style={indentStyle(depth)}
      className={cn(
        "flex w-full items-center gap-[9px] rounded-lg py-[7px] pr-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
        active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--accent-soft)]",
      )}
    >
      <FileText size={14} className="shrink-0 opacity-65" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          active
            ? "font-semibold text-[var(--accent)]"
            : dim
              ? "text-[var(--text-faint)] line-through"
              : "font-medium text-[var(--text)]",
        )}
      >
        {doc.title}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {(doc.warning || !doc.ok || doc.freshness?.stale) && <AlertTriangle size={13} className="text-[var(--warn)]" />}
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: STATUS_DOT[doc.status] ?? "var(--text-faint)" }} title={doc.status} />
      </span>
    </button>
  );
}

function StatusControl({ path, status }: { path: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const set = async (s: string) => {
    setBusy(true);
    try {
      await setDocStatus(path, s); // live-reload refreshes the view
    } catch (e) {
      alert("상태 변경 실패: " + (e as Error).message);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={busy} className="inline-flex items-center gap-1" title="상태 변경">
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>
          {status === "none" ? "set status" : status}
          <ChevronDown size={11} />
        </Badge>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-36 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-[0_10px_32px_rgba(0,0,0,0.14)]">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => set(s)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)]"
            >
              {s}
              {s === status && <Check size={13} className="text-[var(--accent)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdoptControl({ path, uid }: { path: string; uid?: string }) {
  const [busy, setBusy] = useState(false);
  if (uid) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-faint)]" title="추적용 고유 ID (이동해도 유지)">
        <Hash size={11} />
        {uid}
      </span>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      title="이동/이름변경에도 추적되도록 고유 ID를 파일에 부여"
      onClick={async () => {
        setBusy(true);
        try {
          await adoptDoc(path); // live-reload refreshes the view
        } catch (e) {
          alert("Adopt 실패: " + (e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Plus size={13} />
      {busy ? "…" : "Adopt"}
    </Button>
  );
}

function ReviewControl({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      title="오늘 날짜로 검토 완료 표시(re-bless) — 신선도 경고 해제"
      onClick={async () => {
        setBusy(true);
        try {
          await setDocReview(path, {}); // stamps lastReviewed = today; live-reload refreshes
        } catch (e) {
          alert("Review 실패: " + (e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <RefreshCw size={13} />
      {busy ? "…" : "Review"}
    </Button>
  );
}
