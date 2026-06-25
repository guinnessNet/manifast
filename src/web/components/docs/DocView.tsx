import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  LayoutGrid,
  KanbanSquare,
  ChevronDown,
  Check,
  Hash,
  Plus,
  AlertTriangle,
  RefreshCw,
  FileCode,
  Clock,
  FileText,
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
import { adoptDoc, setDocStatus, setDocReview } from "../../lib/api";
import { cn } from "../../lib/cn";

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
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
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

// ── left rail: search + grouped doc list + archived toggle ──────────────────
function docFolder(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const i = norm.lastIndexOf("/");
  return i < 0 ? "" : norm.slice(0, i);
}
function folderLabel(f: string): string {
  if (f === "") return "(root)";
  if (f === ".manifast/prd") return "PRD";
  if (f === ".manifast/specs") return "Specs";
  return f;
}
function folderRank(f: string): number {
  return f === ".manifast/prd" ? 0 : f === ".manifast/specs" ? 1 : f === "" ? 2 : 3;
}

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

  const archivedCount = docs.filter((d) => d.status === "archived").length;
  const query = q.trim().toLowerCase();
  let visible = showArchived ? docs : docs.filter((d) => d.status !== "archived");
  if (query) {
    visible = visible.filter(
      (d) => d.title.toLowerCase().includes(query) || d.path.toLowerCase().includes(query),
    );
  }

  const byFolder = new Map<string, DocMeta[]>();
  for (const d of visible) {
    const f = docFolder(d.path);
    if (!byFolder.has(f)) byFolder.set(f, []);
    byFolder.get(f)!.push(d);
  }
  const folders = [...byFolder.keys()].sort((a, b) => folderRank(a) - folderRank(b) || a.localeCompare(b));

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

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-1">
        {docs.length === 0 && <p className="px-2.5 py-3 text-xs text-[var(--text-faint)]">문서가 없습니다</p>}
        {folders.map((f) => (
          <div key={f}>
            <div className="px-2.5 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">
              {folderLabel(f)} <span className="opacity-70">{byFolder.get(f)!.length}</span>
            </div>
            {byFolder
              .get(f)!
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((d) => {
                const active = selected === d.path;
                const dim = d.status === "deprecated" || d.status === "archived";
                return (
                  <button
                    key={d.path}
                    onClick={() => onSelect(d.path)}
                    className={cn(
                      "flex w-full items-center gap-[9px] rounded-lg px-2.5 py-[7px] text-left transition-colors",
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
                      {d.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {(d.warning || !d.ok || d.freshness?.stale) && (
                        <AlertTriangle size={13} className="text-[var(--warn)]" />
                      )}
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: STATUS_DOT[d.status] ?? "var(--text-faint)" }} title={d.status} />
                    </span>
                  </button>
                );
              })}
          </div>
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
