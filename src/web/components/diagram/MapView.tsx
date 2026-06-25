import { useMemo, useState } from "react";
import type { WorkspaceDTO } from "@shared/types";
import type { DiagramRef } from "@shared/schema/diagram";
import { useFile } from "../../hooks/useFile";
import { Canvas } from "../wireframe/Canvas";
import { ErrorBanner } from "../ErrorBanner";
import { buildProjectMap, getOrphanDocs, getNeighborhood, filterDiagram } from "../../lib/graph";
import { layoutDiagram, type Layout } from "../../lib/layout";
import { smoothPath } from "../../lib/smoothPath";
import { useNavigate, type NavTarget } from "../../lib/nav";
import { cn } from "../../lib/cn";

// "manifast item" nodes read as accent-tinted clickable chips; structural nodes
// stay neutral with a per-kind left-border hue. external = dashed.
const MANIFAST_KINDS = new Set(["doc", "wireframe", "task"]);
const KIND_HUE: Record<string, string> = {
  module: "#3b82f6",
  service: "#8b5cf6",
  layer: "#14b8a6",
  db: "#d97706",
  phase: "#f59e0b",
  external: "#94a3b8",
  folder: "#0ea5e9",
};

function refToTarget(ref: DiagramRef): NavTarget | null {
  if (ref.kind === "wireframe") return { kind: "wireframe", id: ref.id };
  if (ref.kind === "doc") return { kind: "doc", id: ref.id };
  if (ref.kind === "task") return { kind: "task", id: ref.id };
  return null;
}

export interface MapViewProps {
  data: WorkspaceDTO;
  tick: number;
}

export function MapView({ data, tick }: MapViewProps) {
  const [selected, setSelected] = useState("__project__");
  const [showAllDocs, setShowAllDocs] = useState(false);
  // At scale, the auto project map collapses docs into folder super-nodes by
  // default so it reads as structure instead of a 150-node hairball.
  const [aggregate, setAggregate] = useState(() => data.items.docs.length > 40);
  const [focusMode, setFocusMode] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());
  const [showOrphans, setShowOrphans] = useState(false);
  const [showStale, setShowStale] = useState(false);
  const navigate = useNavigate();

  const auto = useMemo(() => buildProjectMap(data, showAllDocs, aggregate), [data, showAllDocs, aggregate]);
  const hiddenDocs = data.items.docs.length - auto.nodes.filter((n) => n.kind === "doc").length;
  const selMeta = data.items.diagrams.find((d) => d.path === selected);
  const { file } = useFile(selected === "__project__" ? undefined : selected, tick);

  const base = selected === "__project__" ? auto : file && file.kind === "diagram" ? file.data : null;

  const edgeKinds = useMemo(
    () => [...new Set((base?.edges ?? []).map((e) => e.kind ?? "link"))].sort(),
    [base],
  );
  // Stale doc ids (AI-free freshness signal from the server) → tint map nodes.
  const staleDocIds = useMemo(
    () => new Set(data.items.docs.filter((d) => d.freshness?.stale).map((d) => d.id)),
    [data],
  );
  // Resolve a doc by its project-root-relative path so diagram nodes authored
  // with ref.kind:"path" are still clickable + freshness-aware (not just "doc").
  const docIdByPath = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of data.items.docs) m.set(d.path, d.id);
    return m;
  }, [data]);
  const resolveRef = (ref: DiagramRef): NavTarget | null => {
    if (ref.kind === "path") {
      const id = docIdByPath.get(ref.id);
      return id ? { kind: "doc", id } : null;
    }
    return refToTarget(ref);
  };
  const refDocId = (ref?: DiagramRef): string | undefined =>
    !ref ? undefined : ref.kind === "doc" ? ref.id : ref.kind === "path" ? docIdByPath.get(ref.id) : undefined;

  // Apply focus (neighborhood) + edge-kind filters before layout.
  const diagram = useMemo(() => {
    if (!base) return null;
    let d = base;
    if (focusMode && focusId) d = filterDiagram(d, getNeighborhood(d, focusId, depth));
    if (hiddenKinds.size) d = { ...d, edges: d.edges.filter((e) => !hiddenKinds.has(e.kind ?? "link")) };
    return d;
  }, [base, focusMode, focusId, depth, hiddenKinds]);

  const layout: Layout | null = useMemo(() => (diagram ? layoutDiagram(diagram) : null), [diagram]);
  const orphans = useMemo(() => (selected === "__project__" ? getOrphanDocs(data) : []), [data, selected]);
  const staleDocs = useMemo(
    () =>
      data.items.docs
        .filter((d) => d.freshness?.stale)
        .map((d) => ({ id: d.id, title: d.title, path: d.path, reason: d.freshness?.reason })),
    [data],
  );

  const errMsg =
    selected !== "__project__"
      ? file && file.kind === "diagram" && !file.ok
        ? file.error
        : selMeta && !selMeta.ok
          ? selMeta.error
          : null
      : null;

  const toggleKind = (k: string) =>
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setFocusId(null);
          }}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-sm text-[var(--text)]"
        >
          <option value="__project__">Project map (auto)</option>
          {data.items.diagrams.map((d) => (
            <option key={d.path} value={d.path}>
              {d.title} · {d.kind}
            </option>
          ))}
        </select>
        {diagram && (
          <span className="text-xs text-[var(--text-faint)]">
            {diagram.nodes.length} nodes · {diagram.edges.length} edges
          </span>
        )}
        {selected === "__project__" && (
          <button
            onClick={() => setAggregate((s) => !s)}
            title="문서를 폴더 단위로 묶어 구조만 보기 / 개별 문서 펼치기"
            className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--accent-soft)]"
          >
            {aggregate ? "개별 문서 펼치기" : "폴더로 집계"}
          </button>
        )}
        {selected === "__project__" && !aggregate && (hiddenDocs > 0 || showAllDocs) && (
          <button
            onClick={() => setShowAllDocs((s) => !s)}
            className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--accent-soft)]"
          >
            {showAllDocs ? "링크 없는 문서 숨기기" : `링크 없는 문서 ${hiddenDocs}개 표시`}
          </button>
        )}

        {/* Focus (neighborhood) mode */}
        <label className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]" title="노드를 클릭하면 그 이웃(1~N홉)만 보기">
          <input
            type="checkbox"
            checked={focusMode}
            onChange={(e) => {
              setFocusMode(e.target.checked);
              if (!e.target.checked) setFocusId(null);
            }}
          />
          focus
        </label>
        {focusMode && focusId && (
          <>
            <label className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
              depth
              <input type="range" min={1} max={3} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
              {depth}
            </label>
            <button onClick={() => setFocusId(null)} className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--accent-soft)]">
              전체 보기
            </button>
          </>
        )}
        {focusMode && !focusId && <span className="text-xs text-[var(--text-faint)]">노드를 클릭해 이웃만 보기</span>}

        {/* Edge-kind filters */}
        {edgeKinds.length > 1 &&
          edgeKinds.map((k) => (
            <button
              key={k}
              onClick={() => toggleKind(k)}
              title={`관계 '${k}' 토글`}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px]",
                hiddenKinds.has(k)
                  ? "border-[var(--border)] bg-[var(--bg)] text-[var(--text-faint)] line-through"
                  : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)]",
              )}
            >
              {k}
            </button>
          ))}

        {/* Orphans */}
        {selected === "__project__" && orphans.length > 0 && (
          <button
            onClick={() => setShowOrphans((s) => !s)}
            className="rounded-md px-2 py-1 text-xs text-[var(--warn)] hover:bg-[var(--warn-bg)]"
          >
            고아 문서 {orphans.length}개
          </button>
        )}
        {/* Stale (검토 필요) */}
        {staleDocs.length > 0 && (
          <button
            onClick={() => setShowStale((s) => !s)}
            className="rounded-md px-2 py-1 text-xs text-[var(--warn)] hover:bg-[var(--warn-bg)]"
          >
            검토 필요 {staleDocs.length}개
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {errMsg ? (
          <div className="p-4">
            <ErrorBanner path={selected} message={errMsg} />
          </div>
        ) : !layout || layout.nodes.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-[var(--text-faint)]">표시할 노드가 없습니다.</div>
        ) : (
          <Canvas contentW={layout.width} contentH={layout.height} fitKey={`${selected}:${focusId ?? ""}:${depth}`}>
            <div style={{ position: "relative", width: layout.width, height: layout.height }}>
              {/* groups behind */}
              {layout.groups.map((grp) => (
                <div
                  key={grp.id}
                  style={{
                    position: "absolute",
                    left: grp.x,
                    top: grp.y,
                    width: grp.w,
                    height: grp.h,
                    background: "transparent",
                    border: "1.5px dashed var(--border)",
                    borderRadius: 14,
                  }}
                >
                  <span style={{ position: "absolute", top: 6, left: 10, fontSize: 11, fontWeight: 600, color: "var(--text-faint)" }}>
                    {grp.label}
                  </span>
                </div>
              ))}

              {/* edges */}
              <svg width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
                <defs>
                  <marker id="mf-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L8,4 L0,8 z" fill="var(--wire-strong)" />
                  </marker>
                </defs>
                {layout.edges.map((e, i) => {
                  const mid = e.points[Math.floor(e.points.length / 2)];
                  return (
                    <g key={i}>
                      <path d={smoothPath(e.points)} fill="none" stroke="var(--wire-strong)" strokeWidth={1.5} strokeLinecap="round" markerEnd="url(#mf-arrow)" />
                      {e.edge.label && mid && (
                        <text x={mid.x} y={mid.y - 4} fontSize={10} textAnchor="middle" fill="var(--text-faint)">
                          {e.edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* nodes */}
              {layout.nodes.map((n) => {
                const kind = n.node.kind ?? "";
                const isManifast = MANIFAST_KINDS.has(kind);
                const isExternal = kind === "external";
                const hue = KIND_HUE[kind];
                const target = n.node.ref ? resolveRef(n.node.ref) : null;
                const did = refDocId(n.node.ref);
                const stale = !!did && staleDocIds.has(did);
                const clickable = focusMode || !!target;
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (focusMode) setFocusId(n.id);
                      else if (target) navigate(target);
                    }}
                    title={stale ? `${n.node.label} — 검토 필요(stale)` : n.node.description ?? n.node.label}
                    style={{
                      position: "absolute",
                      left: n.x,
                      top: n.y,
                      width: n.w,
                      height: n.h,
                      background: isManifast ? "var(--accent-subtle)" : "var(--bg-elevated)",
                      border: stale
                        ? "1px solid var(--warn)"
                        : isManifast
                          ? "1px solid var(--accent-border)"
                          : isExternal
                            ? `1.5px dashed ${hue ?? "var(--border)"}`
                            : "1px solid var(--border)",
                      borderLeft:
                        !stale && !isManifast && !isExternal && hue ? `3px solid ${hue}` : undefined,
                      color: isManifast ? "var(--accent)" : "var(--text)",
                      borderRadius: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 12px",
                      fontSize: 13,
                      fontWeight: 500,
                      textAlign: "center",
                      boxShadow: stale ? "0 0 0 2px var(--warn-border)" : "0 1px 2px rgba(0,0,0,0.05)",
                      cursor: clickable ? "pointer" : "default",
                      overflow: "hidden",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.node.label}</span>
                  </div>
                );
              })}
            </div>
          </Canvas>
        )}

        {/* Orphans panel */}
        {showOrphans && orphans.length > 0 && (
          <div className="absolute right-3 top-3 z-20 max-h-[70%] w-64 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-[0_10px_32px_rgba(0,0,0,0.14)]">
            <div className="mb-1 flex items-center justify-between px-1 text-xs font-semibold text-[var(--text-muted)]">
              <span>고아 문서 (링크 없음)</span>
              <button onClick={() => setShowOrphans(false)} className="text-[var(--text-faint)] hover:text-[var(--text)]">
                ×
              </button>
            </div>
            {orphans.map((o) => (
              <button
                key={o.id}
                onClick={() => navigate({ kind: "doc", id: o.id })}
                className="block w-full truncate rounded-md px-2 py-1 text-left text-xs text-[var(--text-muted)] hover:bg-[var(--accent-soft)]"
                title={o.path}
              >
                {o.title}
              </button>
            ))}
          </div>
        )}

        {/* Stale docs panel */}
        {showStale && staleDocs.length > 0 && (
          <div className="absolute left-3 top-3 z-20 max-h-[70%] w-72 overflow-auto rounded-xl border border-[var(--warn-border)] bg-[var(--bg-elevated)] p-2 shadow-[0_10px_32px_rgba(0,0,0,0.14)]">
            <div className="mb-1 flex items-center justify-between px-1 text-xs font-semibold text-[var(--warn)]">
              <span>검토 필요 (stale)</span>
              <button onClick={() => setShowStale(false)} className="text-[var(--text-faint)] hover:text-[var(--text)]">
                ×
              </button>
            </div>
            {staleDocs.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate({ kind: "doc", id: d.id })}
                className="block w-full rounded-md px-2 py-1 text-left hover:bg-[var(--warn-bg)]"
                title={d.path}
              >
                <div className="truncate text-xs text-[var(--text)]">{d.title}</div>
                {d.reason && <div className="truncate text-[10px] text-[var(--warn)]">{d.reason}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
