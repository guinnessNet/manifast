import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceDTO } from "@shared/types";
import type { DiagramRef } from "@shared/schema/diagram";
import { FileText, LayoutGrid, SquareCheckBig, Folder, Milestone, type LucideIcon } from "lucide-react";
import { useFile } from "../../hooks/useFile";
import { Canvas } from "../wireframe/Canvas";
import { ErrorBanner } from "../ErrorBanner";
import { MapExportMenu } from "../ExportMenu";
import { buildProjectMap, getOrphanDocs, getNeighborhood, filterDiagram } from "../../lib/graph";
import { layoutDiagram, isFlowKind, isTreeKind, type Layout } from "../../lib/layout";
import { smoothPath } from "../../lib/smoothPath";
import { useNavigate, type NavTarget } from "../../lib/nav";
import { cn } from "../../lib/cn";

// "manifast item" nodes (doc/wireframe/task) get a distinct per-kind hue + icon
// so a user can tell documents from screens from tasks at a glance; structural
// nodes stay neutral with a per-kind left-border hue. external = dashed. Flow /
// tree kinds get a full "typed" treatment (filled tint + colored border).
const MANIFAST_KINDS = new Set(["doc", "wireframe", "task"]);
const KIND_HUE: Record<string, string> = {
  // manifast items — the auto project map's primary node kinds
  doc: "#0ea5e9",
  wireframe: "#8b5cf6",
  task: "#f97316",
  // architecture maps — subtle per-kind left-border hue
  module: "#3b82f6",
  service: "#8b5cf6",
  layer: "#14b8a6",
  db: "#d97706",
  phase: "#f59e0b",
  external: "#94a3b8",
  folder: "#0ea5e9",
  // user-flow nodes
  start: "#22c55e",
  end: "#f43f5e",
  terminator: "#f43f5e",
  page: "#3b82f6",
  screen: "#3b82f6",
  action: "#f59e0b",
  decision: "#8b5cf6",
  // feature-tree nodes
  project: "#6366f1",
  requirement: "#0ea5e9",
  req: "#0ea5e9",
  feature: "#14b8a6",
  detail: "#94a3b8",
};
// Flow / tree kinds render filled (tinted bg + colored border) so a user flow or
// feature tree reads as typed nodes, not uniform boxes. Structural kinds (module,
// service, …) keep the lighter left-border look instead.
const TYPED_KINDS = new Set([
  "start", "end", "terminator", "page", "screen", "action", "decision",
  "project", "requirement", "req", "feature", "detail",
]);
// Terminators render as stadium/pills; everything else stays a rounded rect.
const PILL_KINDS = new Set(["start", "end", "terminator"]);

// Tiny inline icon per manifast kind — the icon (not just hue) is what makes
// two same-named chips ("Dashboard" the doc vs "Dashboard" the screen) tellable apart.
const KIND_ICON: Record<string, LucideIcon> = {
  doc: FileText,
  wireframe: LayoutGrid,
  task: SquareCheckBig,
  folder: Folder,
  phase: Milestone,
};

// Per-relation edge styling. Weak/derived relations are dashed; strong authored
// relations are solid and hued. Anything unknown falls back to the theme token.
const EDGE_STYLE: Record<string, { color: string; dash?: string }> = {
  links: { color: "#64748b" },
  related: { color: "#94a3b8", dash: "5 4" },
  references: { color: "#94a3b8", dash: "5 4" },
  source: { color: "#a1a1aa", dash: "2 4" },
  dep: { color: "#f97316" },
  spec: { color: "#0ea5e9" },
  screen: { color: "#8b5cf6" },
  task: { color: "#f59e0b" },
  deprecatedBy: { color: "#ef4444", dash: "3 3" },
};
const DEFAULT_EDGE_COLOR = "var(--edge)";
function edgeStyleOf(kind?: string): { color: string; dash?: string } {
  return EDGE_STYLE[kind ?? ""] ?? { color: DEFAULT_EDGE_COLOR };
}
/** Stable DOM id for a marker of a given color ("#0ea5e9" → "mf-arrow-0ea5e9"). */
function markerId(color: string): string {
  return `mf-arrow-${color.replace(/[^a-zA-Z0-9]+/g, "")}`;
}

function refToTarget(ref: DiagramRef): NavTarget | null {
  if (ref.kind === "wireframe") return { kind: "wireframe", id: ref.id };
  if (ref.kind === "doc") return { kind: "doc", id: ref.id };
  if (ref.kind === "task") return { kind: "task", id: ref.id };
  return null;
}

export interface MapViewProps {
  data: WorkspaceDTO;
  tick: number;
  /** "flow"/"tree" scope the view to user-flow / hierarchy diagrams (dedicated tabs). */
  mode?: "map" | "flow" | "tree";
}

// Predicate that picks which diagrams a scoped view (flow/tree) shows.
function modeMatch(mode: "map" | "flow" | "tree"): ((kind?: string) => boolean) | null {
  return mode === "flow" ? isFlowKind : mode === "tree" ? isTreeKind : null;
}

export function MapView({ data, tick, mode = "map" }: MapViewProps) {
  const match = modeMatch(mode);
  const modeDiagrams = useMemo(
    () => (match ? data.items.diagrams.filter((d) => match(d.kind)) : data.items.diagrams),
    [data, mode],
  );
  const diagramOptions = modeDiagrams;
  const contentRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() =>
    match ? (data.items.diagrams.find((d) => match(d.kind))?.path ?? "") : "__project__",
  );
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

  // In a scoped view, latch onto the first matching diagram once one exists (e.g.
  // after the agent authors it and live-reload delivers it).
  useEffect(() => {
    if (match && (selected === "" || selected === "__project__") && modeDiagrams[0]) {
      setSelected(modeDiagrams[0].path);
    }
  }, [mode, modeDiagrams, selected]);

  const auto = useMemo(() => buildProjectMap(data, showAllDocs, aggregate), [data, showAllDocs, aggregate]);
  const hiddenDocs = data.items.docs.length - auto.nodes.filter((n) => n.kind === "doc").length;
  const selMeta = data.items.diagrams.find((d) => d.path === selected);
  const exportName = selected === "__project__" ? "project-map" : selMeta?.title ?? "diagram";
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

  if (match && modeDiagrams.length === 0) {
    const isFlow = mode === "flow";
    const title = isFlow ? "No User Flow diagram yet." : "No Tree diagram yet.";
    const kindLiteral = isFlow ? '"kind": "flow"' : '"kind": "tree"';
    const kinds = isFlow ? "start · page · action · decision · end" : "project · requirement · feature · detail";
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div className="max-w-md">
          <p className="text-sm font-medium text-[var(--text)]">{title}</p>
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-faint)]">
            When an agent writes{" "}
            <code className="rounded bg-[var(--bg-elevated)] px-1 py-0.5 font-mono text-[var(--text-muted)]">
              .manifast/diagrams/&lt;id&gt;.json
            </code>{" "}
            with{" "}
            <code className="rounded bg-[var(--bg-elevated)] px-1 py-0.5 font-mono text-[var(--text-muted)]">
              {kindLiteral}
            </code>
            , it’s auto-arranged and rendered here. Node <code className="font-mono">kind</code> is one of {kinds}.
          </p>
        </div>
      </div>
    );
  }

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
          {mode === "map" && <option value="__project__">Project map (auto)</option>}
          {diagramOptions.map((d) => (
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
            title="Group docs by folder for a structural view / expand individual docs"
            className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--accent-soft)]"
          >
            {aggregate ? "Expand docs" : "Group by folder"}
          </button>
        )}
        {selected === "__project__" && !aggregate && (hiddenDocs > 0 || showAllDocs) && (
          <button
            onClick={() => setShowAllDocs((s) => !s)}
            className="rounded-md px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--accent-soft)]"
          >
            {showAllDocs ? "Hide unlinked docs" : `Show ${hiddenDocs} unlinked docs`}
          </button>
        )}

        {/* Focus (neighborhood) mode */}
        <label className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]" title="Click a node to show only its neighbors (1–N hops)">
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
              Show all
            </button>
          </>
        )}
        {focusMode && !focusId && <span className="text-xs text-[var(--text-faint)]">Click a node to show its neighbors</span>}

        {/* Edge-kind filters (double as the edge-color legend) */}
        {edgeKinds.length > 1 &&
          edgeKinds.map((k) => (
            <button
              key={k}
              onClick={() => toggleKind(k)}
              title={`Toggle '${k}' relation`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px]",
                hiddenKinds.has(k)
                  ? "border-[var(--border)] bg-[var(--bg)] text-[var(--text-faint)] line-through"
                  : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)]",
              )}
            >
              <span
                className="inline-block h-[3px] w-3.5 rounded-full"
                style={{
                  background: hiddenKinds.has(k) ? "var(--border)" : edgeStyleOf(k).color,
                  opacity: edgeStyleOf(k).dash ? 0.75 : 1,
                }}
              />
              {k}
            </button>
          ))}

        {/* Orphans */}
        {selected === "__project__" && orphans.length > 0 && (
          <button
            onClick={() => setShowOrphans((s) => !s)}
            className="rounded-md px-2 py-1 text-xs text-[var(--warn)] hover:bg-[var(--warn-bg)]"
          >
            {orphans.length} orphan docs
          </button>
        )}
        {/* Stale (needs review) */}
        {staleDocs.length > 0 && (
          <button
            onClick={() => setShowStale((s) => !s)}
            className="rounded-md px-2 py-1 text-xs text-[var(--warn)] hover:bg-[var(--warn-bg)]"
          >
            {staleDocs.length} need review
          </button>
        )}

        {layout && layout.nodes.length > 0 && (
          <div className="ml-auto">
            <MapExportMenu
              contentRef={contentRef}
              name={exportName}
              path={selected !== "__project__" && selected !== "" ? selected : undefined}
            />
          </div>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {errMsg ? (
          <div className="p-4">
            <ErrorBanner path={selected} message={errMsg} />
          </div>
        ) : !layout || layout.nodes.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-[var(--text-faint)]">No nodes to show.</div>
        ) : (
          <Canvas contentW={layout.width} contentH={layout.height} fitKey={`${selected}:${focusId ?? ""}:${depth}`}>
            <div ref={contentRef} style={{ position: "relative", width: layout.width, height: layout.height }}>
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
                  {[...new Set(layout.edges.map((e) => edgeStyleOf(e.edge.kind).color))].map((color) => (
                    <marker
                      key={color}
                      id={markerId(color)}
                      viewBox="0 0 10 10"
                      refX="8.5"
                      refY="5"
                      markerWidth="8.5"
                      markerHeight="8.5"
                      orient="auto-start-reverse"
                    >
                      <path d="M0,0.8 L9.2,5 L0,9.2 z" fill={color} />
                    </marker>
                  ))}
                </defs>
                {layout.edges.map((e, i) => {
                  const style = edgeStyleOf(e.edge.kind);
                  const mid = e.labelPos ?? e.points[Math.floor(e.points.length / 2)];
                  const d = smoothPath(e.points);
                  return (
                    <g key={i}>
                      {/* invisible fat stroke = hover target for the relation tooltip */}
                      <path d={d} fill="none" stroke="transparent" strokeWidth={11} style={{ pointerEvents: "stroke" }}>
                        <title>{`${e.from.replace(/^\w+:/, "")} → ${e.to.replace(/^\w+:/, "")}${e.edge.kind ? ` · ${e.edge.kind}` : ""}`}</title>
                      </path>
                      <path
                        d={d}
                        fill="none"
                        stroke={style.color}
                        strokeWidth={1.75}
                        strokeDasharray={style.dash}
                        strokeLinecap="round"
                        markerEnd={`url(#${markerId(style.color)})`}
                      />
                      {e.edge.label && mid && (
                        <text
                          x={mid.x}
                          y={mid.y + 3.5}
                          fontSize={10.5}
                          fontWeight={500}
                          textAnchor="middle"
                          fill="var(--edge-label)"
                          stroke="var(--bg)"
                          strokeWidth={3.5}
                          strokeLinejoin="round"
                          paintOrder="stroke"
                        >
                          {e.edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* nodes */}
              {layout.nodes.map((n) => {
                const kind = (n.node.kind ?? "").toLowerCase();
                const isManifast = MANIFAST_KINDS.has(kind);
                const isExternal = kind === "external";
                const hue = KIND_HUE[kind];
                const typed = !!hue && TYPED_KINDS.has(kind);
                const pill = PILL_KINDS.has(kind);
                const Icon = KIND_ICON[kind];
                const target = n.node.ref ? resolveRef(n.node.ref) : null;
                const did = refDocId(n.node.ref);
                const stale = !!did && staleDocIds.has(did);
                const clickable = focusMode || !!target;
                const onClick = () => {
                  if (focusMode) setFocusId(n.id);
                  else if (target) navigate(target);
                };
                const title = stale ? `${n.node.label} — needs review (stale)` : n.node.description ?? n.node.label;
                // Multi-line labels wrap to 2 lines before ellipsizing (layout.ts
                // sizes the chip accordingly) — long titles stay readable.
                const labelStyle: React.CSSProperties = {
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  wordBreak: "break-word",
                  lineHeight: 1.3,
                };

                if (kind === "decision") {
                  // Flowchart decision = diamond (rotated square under a level label).
                  const inset = (n.w * (1 - 1 / Math.SQRT2)) / 2;
                  return (
                    <div
                      key={n.id}
                      onClick={onClick}
                      title={title}
                      style={{
                        position: "absolute",
                        left: n.x,
                        top: n.y,
                        width: n.w,
                        height: n.h,
                        cursor: clickable ? "pointer" : "default",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset,
                          transform: "rotate(45deg)",
                          background: `${hue}1f`,
                          border: stale ? "1.5px solid var(--warn)" : `1.5px solid ${hue}`,
                          borderRadius: 12,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 16%",
                        }}
                      >
                        <span style={{ ...labelStyle, fontSize: 12.5, fontWeight: 600, textAlign: "center", color: "var(--text)" }}>
                          {n.node.label}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={n.id}
                    onClick={onClick}
                    title={title}
                    style={{
                      position: "absolute",
                      left: n.x,
                      top: n.y,
                      width: n.w,
                      height: n.h,
                      background: isManifast
                        ? `${hue}14`
                        : typed
                          ? `${hue}${pill ? "30" : "1f"}`
                          : "var(--bg-elevated)",
                      border: stale
                        ? "1px solid var(--warn)"
                        : isManifast
                          ? `1.5px solid ${hue}55`
                          : isExternal
                            ? `1.5px dashed ${hue ?? "var(--border)"}`
                            : typed
                              ? `1.5px solid ${hue}`
                              : "1px solid var(--border)",
                      borderLeft:
                        !stale && !isManifast && !isExternal && !typed && hue ? `3px solid ${hue}` : undefined,
                      color: "var(--text)",
                      borderRadius: pill ? 999 : 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      padding: "0 12px",
                      fontSize: 13,
                      fontWeight: 500,
                      textAlign: "center",
                      boxShadow: stale ? "0 0 0 2px var(--warn-border)" : "0 1px 2px rgba(0,0,0,0.05)",
                      cursor: clickable ? "pointer" : "default",
                      overflow: "hidden",
                    }}
                  >
                    {Icon && <Icon size={13} style={{ flexShrink: 0, color: hue ?? "var(--text-faint)" }} />}
                    <span style={labelStyle}>{n.node.label}</span>
                  </div>
                );
              })}
            </div>
          </Canvas>
        )}

        {/* Node-kind legend (bottom-right, clear of the zoom pill) */}
        {layout && layout.nodes.length > 0 && (() => {
          const kinds = [...new Set(layout.nodes.map((n) => (n.node.kind ?? "").toLowerCase()))].filter(
            (k) => KIND_HUE[k],
          );
          if (kinds.length < 2) return null;
          return (
            <div className="pointer-events-none absolute bottom-4 right-3 z-10 flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/95 px-2.5 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
              {kinds.map((k) => {
                const Icon = KIND_ICON[k];
                return (
                  <span key={k} className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--text-muted)]">
                    {Icon ? (
                      <Icon size={11} style={{ color: KIND_HUE[k] }} />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-[3px]" style={{ background: KIND_HUE[k] }} />
                    )}
                    {k}
                  </span>
                );
              })}
            </div>
          );
        })()}

        {/* Orphans panel */}
        {showOrphans && orphans.length > 0 && (
          <div className="absolute right-3 top-3 z-20 max-h-[70%] w-64 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-[0_10px_32px_rgba(0,0,0,0.14)]">
            <div className="mb-1 flex items-center justify-between px-1 text-xs font-semibold text-[var(--text-muted)]">
              <span>Orphan docs (no links)</span>
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
              <span>Needs review (stale)</span>
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
