import * as dagreNs from "@dagrejs/dagre";
import type { DiagramFile, DiagramNode, DiagramEdge } from "@shared/schema/diagram";

// @dagrejs/dagre may expose its API as default or namespace; handle both.
const dagre: any = (dagreNs as any).default ?? dagreNs;

export interface LaidNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  node: DiagramNode;
}
export interface LaidEdge {
  from: string;
  to: string;
  points: { x: number; y: number }[];
  edge: DiagramEdge;
}
export interface LaidGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Layout {
  nodes: LaidNode[];
  edges: LaidEdge[];
  groups: LaidGroup[];
  width: number;
  height: number;
}

function nodeSize(label: string): { w: number; h: number } {
  const w = Math.max(96, Math.min(260, label.length * 7.5 + 28));
  return { w, h: 46 };
}

/**
 * Resolve which visual layout strategy to use. Explicit `layout` wins; otherwise
 * we infer from `kind` so existing diagrams improve with no re-authoring:
 *   docmap / mindmap / relations → radial (hub-and-spoke mind map)
 *   sitemap / tree               → tree (top-down hierarchy)
 *   architecture / flow / else   → layered (dagre — directional tiers)
 */
export type LayoutStrategy = "layered" | "radial" | "tree";
export function resolveLayout(d: DiagramFile): LayoutStrategy {
  if (d.layout) return d.layout;
  const k = (d.kind ?? "").toLowerCase();
  if (k === "docmap" || k === "mindmap" || k === "relations" || k === "concept") return "radial";
  if (k === "sitemap" || k === "tree" || k === "hierarchy") return "tree";
  return "layered";
}

export function layoutDiagram(d: DiagramFile): Layout {
  switch (resolveLayout(d)) {
    case "radial":
      return layoutRadial(d);
    case "tree":
      // A tree is a top-down hierarchy; dagre handles it well with tight ranks.
      return layoutDagre(d, { rankdir: d.direction ?? "TB", nodesep: 22, ranksep: 48 });
    default:
      return layoutDagre(d, { rankdir: d.direction ?? "TB", nodesep: 28, ranksep: 60 });
  }
}

// ---------------------------------------------------------------------------
// Layered (dagre) — directional tiers; right for architecture / flow / backend.
// `groups` render as compound cluster boxes (visual lanes).
// ---------------------------------------------------------------------------
function layoutDagre(
  d: DiagramFile,
  opts: { rankdir: string; nodesep: number; ranksep: number },
): Layout {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir: opts.rankdir, nodesep: opts.nodesep, ranksep: opts.ranksep, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  const groups = d.groups ?? [];
  for (const grp of groups) g.setNode(`__g__${grp.id}`, { label: grp.label });

  const sizes = new Map<string, { w: number; h: number }>();
  for (const n of d.nodes) {
    const s = nodeSize(n.label);
    sizes.set(n.id, s);
    g.setNode(n.id, { width: s.w, height: s.h });
    if (n.group && groups.some((gr) => gr.id === n.group)) {
      try {
        g.setParent(n.id, `__g__${n.group}`);
      } catch {
        /* ignore compound issues */
      }
    }
  }

  const ids = new Set(d.nodes.map((n) => n.id));
  for (const e of d.edges) if (ids.has(e.from) && ids.has(e.to)) g.setEdge(e.from, e.to);

  dagre.layout(g);

  const nodes: LaidNode[] = d.nodes.map((n) => {
    const gn = g.node(n.id);
    const s = sizes.get(n.id)!;
    const cx = gn?.x ?? 0;
    const cy = gn?.y ?? 0;
    return { id: n.id, x: cx - s.w / 2, y: cy - s.h / 2, w: s.w, h: s.h, node: n };
  });

  const edges: LaidEdge[] = [];
  for (const e of d.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    const ge = g.edge(e.from, e.to);
    if (ge?.points?.length) edges.push({ from: e.from, to: e.to, points: ge.points, edge: e });
  }

  const laidGroups: LaidGroup[] = [];
  for (const grp of groups) {
    const gn = g.node(`__g__${grp.id}`);
    if (gn && gn.width != null && gn.height != null) {
      laidGroups.push({ id: grp.id, label: grp.label, x: gn.x - gn.width / 2, y: gn.y - gn.height / 2, w: gn.width, h: gn.height });
    }
  }

  const gg = g.graph();
  return { nodes, edges, groups: laidGroups, width: gg.width ?? 0, height: gg.height ?? 0 };
}

// ---------------------------------------------------------------------------
// Radial (mind map) — a hub at the center with related nodes on concentric
// rings by hop-distance. Right for document-relationship / concept maps where
// the dagre tiering reads as a meaningless flow. Groups are not drawn (a mind
// map is hub-centric, not lane-based); node kind still tints the chips.
// ---------------------------------------------------------------------------
function layoutRadial(d: DiagramFile): Layout {
  const nodesIn = d.nodes;
  if (nodesIn.length === 0) return { nodes: [], edges: [], groups: [], width: 0, height: 0 };

  const ids = new Set(nodesIn.map((n) => n.id));
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    let s = adj.get(a);
    if (!s) adj.set(a, (s = new Set()));
    s.add(b);
  };
  for (const e of d.edges) {
    if (ids.has(e.from) && ids.has(e.to)) {
      link(e.from, e.to);
      link(e.to, e.from);
    }
  }

  // Hub = highest-degree node (ties → first authored). The map reads outward from it.
  let hub = nodesIn[0].id;
  let bestDeg = -1;
  for (const n of nodesIn) {
    const deg = adj.get(n.id)?.size ?? 0;
    if (deg > bestDeg) {
      bestDeg = deg;
      hub = n.id;
    }
  }

  // BFS hop-distance (ring level) + parent (for angular ordering).
  const level = new Map<string, number>([[hub, 0]]);
  const parent = new Map<string, string>();
  const queue = [hub];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const nb of adj.get(cur) ?? []) {
      if (!level.has(nb)) {
        level.set(nb, level.get(cur)! + 1);
        parent.set(nb, cur);
        queue.push(nb);
      }
    }
  }
  // Disconnected nodes go on an extra outer ring so nothing is lost.
  let maxLvl = 0;
  for (const v of level.values()) maxLvl = Math.max(maxLvl, v);
  for (const n of nodesIn) if (!level.has(n.id)) level.set(n.id, maxLvl + 1);
  maxLvl = 0;
  for (const v of level.values()) maxLvl = Math.max(maxLvl, v);

  const byLevel = new Map<number, string[]>();
  for (const n of nodesIn) {
    const l = level.get(n.id)!;
    let arr = byLevel.get(l);
    if (!arr) byLevel.set(l, (arr = []));
    arr.push(n.id);
  }

  const RING = 250; // px between rings — wide enough for 260px-max chips not to touch
  const angle = new Map<string, number>();
  const pos = new Map<string, { x: number; y: number }>();
  pos.set(hub, { x: 0, y: 0 });
  angle.set(hub, 0);
  for (let l = 1; l <= maxLvl; l++) {
    const ring = (byLevel.get(l) ?? []).slice();
    // Order nodes around the ring by their parent's angle to reduce edge crossings.
    ring.sort((a, b) => (angle.get(parent.get(a) ?? hub) ?? 0) - (angle.get(parent.get(b) ?? hub) ?? 0));
    const n = ring.length;
    const r = RING * l;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / Math.max(1, n);
      angle.set(ring[i], a);
      pos.set(ring[i], { x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }

  const sizes = new Map<string, { w: number; h: number }>();
  for (const n of nodesIn) sizes.set(n.id, nodeSize(n.label));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodesIn) {
    const p = pos.get(n.id)!;
    const s = sizes.get(n.id)!;
    minX = Math.min(minX, p.x - s.w / 2);
    minY = Math.min(minY, p.y - s.h / 2);
    maxX = Math.max(maxX, p.x + s.w / 2);
    maxY = Math.max(maxY, p.y + s.h / 2);
  }

  const M = 48; // canvas margin
  const offX = M - minX;
  const offY = M - minY;
  const laidNodes: LaidNode[] = nodesIn.map((n) => {
    const p = pos.get(n.id)!;
    const s = sizes.get(n.id)!;
    return { id: n.id, x: p.x - s.w / 2 + offX, y: p.y - s.h / 2 + offY, w: s.w, h: s.h, node: n };
  });

  const centerById = new Map(laidNodes.map((l) => [l.id, { x: l.x + l.w / 2, y: l.y + l.h / 2 }]));
  const edges: LaidEdge[] = [];
  for (const e of d.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    const a = centerById.get(e.from)!;
    const b = centerById.get(e.to)!;
    edges.push({ from: e.from, to: e.to, points: [a, b], edge: e });
  }

  return { nodes: laidNodes, edges, groups: [], width: maxX - minX + 2 * M, height: maxY - minY + 2 * M };
}
