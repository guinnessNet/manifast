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
  /** Anchor for the edge label (dagre-reserved or geometric midpoint). */
  labelPos?: { x: number; y: number };
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

// ---------------------------------------------------------------------------
// Label measurement — canvas measureText matches the actual render font, so
// CJK labels (≈13px/glyph vs ≈7px Latin) size correctly instead of truncating.
// Falls back to a CJK-weighted estimate under SSR / test DOMs without canvas.
// ---------------------------------------------------------------------------
const NODE_FONT = '500 13px ui-sans-serif, system-ui, "Segoe UI", "Malgun Gothic", sans-serif';
let measureCtx: CanvasRenderingContext2D | null | undefined;
export function measureLabel(label: string): number {
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    } catch {
      measureCtx = null;
    }
  }
  if (measureCtx) {
    try {
      measureCtx.font = NODE_FONT;
      const w = measureCtx.measureText(label).width;
      if (Number.isFinite(w) && w > 0) return w;
    } catch {
      /* fall through to the estimate */
    }
  }
  let w = 0;
  for (const ch of label) {
    const cp = ch.codePointAt(0)!;
    w += cp > 0x2e7f ? 13.5 : cp > 0xff ? 9 : 7.2;
  }
  return w;
}

/** Longest single-line text width inside a chip before wrapping to 2 lines. */
const SINGLE_LINE_MAX = 220;
const CHIP_PAD = 30; // 12px horizontal padding ×2 + borders
/** Kinds MapView prefixes with a 13px icon + 7px gap — reserve that width too. */
const ICON_KINDS = new Set(["doc", "wireframe", "task", "folder", "phase"]);

function nodeSize(n: DiagramNode): { w: number; h: number } {
  const label = n.label ?? "";
  const kind = (n.kind ?? "").toLowerCase();
  const measured = measureLabel(label);
  const iconPad = ICON_KINDS.has(kind) ? 22 : 0;
  if (kind === "decision") {
    // Diamond: rendered as a rotated square, so reserve a square bounding box.
    const side = Math.min(Math.max(measured * 0.9 + 52, 104), 176);
    return { w: side, h: side };
  }
  if (measured <= SINGLE_LINE_MAX) {
    return { w: Math.max(96, Math.ceil(measured) + CHIP_PAD + iconPad), h: 46 };
  }
  // Wrap to two lines: width for the longer half of the text, taller chip.
  const lineW = Math.min(Math.max(measured / 2 + 14, 132), 248);
  return { w: Math.ceil(lineW) + CHIP_PAD + iconPad, h: 62 };
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
  // flow / userflow are directional — the default layered dagre is exactly right.
  return "layered";
}

/** Diagram kinds that read as a user-flow (typed nodes + directional, labelled edges). */
const FLOW_KINDS = new Set(["flow", "userflow", "user-flow", "flowchart"]);
export function isFlowKind(kind?: string): boolean {
  return FLOW_KINDS.has((kind ?? "").toLowerCase());
}

/** Diagram kinds that read as a top-down hierarchy / feature tree. */
const TREE_KINDS = new Set(["tree", "sitemap", "hierarchy", "featuretree", "feature-tree"]);
export function isTreeKind(kind?: string): boolean {
  return TREE_KINDS.has((kind ?? "").toLowerCase());
}

export function layoutDiagram(d: DiagramFile): Layout {
  switch (resolveLayout(d)) {
    case "radial":
      return layoutRadial(d);
    case "tree":
      // A tree is a top-down hierarchy; dagre handles it well with tight ranks.
      return layoutDagre(d, { rankdir: d.direction ?? "TB", nodesep: 24, ranksep: 52 });
    default:
      return layoutDagre(d, { rankdir: d.direction ?? "TB", nodesep: 32, ranksep: 64 });
  }
}

/** Geometric midpoint of a polyline's endpoints (label anchor fallback). */
function midpoint(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 2) {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }
  return points[Math.floor(points.length / 2)];
}

/**
 * Walk from a node's CENTER toward `to`, stopping at the node's rectangle
 * boundary (+pad). Keeps arrowheads/labels outside the chip instead of buried
 * under it. Clamped to the half-segment so close/overlapping nodes don't invert.
 */
function trimToRect(
  center: { x: number; y: number },
  to: { x: number; y: number },
  w: number,
  h: number,
  pad = 3,
): { x: number; y: number } {
  const dx = to.x - center.x;
  const dy = to.y - center.y;
  if (dx === 0 && dy === 0) return { ...center };
  const hw = w / 2 + pad;
  const hh = h / 2 + pad;
  const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty, 0.5);
  return { x: center.x + dx * t, y: center.y + dy * t };
}

// ---------------------------------------------------------------------------
// Layered (dagre) — directional tiers; right for architecture / flow / backend.
// `groups` render as compound cluster boxes (visual lanes). The graph is a
// MULTIGRAPH: parallel edges between the same pair each get their own routing
// instead of silently overwriting each other.
// ---------------------------------------------------------------------------
function layoutDagre(
  d: DiagramFile,
  opts: { rankdir: string; nodesep: number; ranksep: number },
): Layout {
  const g = new dagre.graphlib.Graph({ compound: true, multigraph: true });
  g.setGraph({ rankdir: opts.rankdir, nodesep: opts.nodesep, ranksep: opts.ranksep, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));

  const groups = d.groups ?? [];
  for (const grp of groups) g.setNode(`__g__${grp.id}`, { label: grp.label });

  const sizes = new Map<string, { w: number; h: number }>();
  for (const n of d.nodes) {
    const s = nodeSize(n);
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
  d.edges.forEach((e, i) => {
    if (!ids.has(e.from) || !ids.has(e.to)) return;
    // Reserve room for the label so dagre routes around it and hands back an anchor.
    const labelDims = e.label
      ? { width: measureLabel(e.label) * (10.5 / 13) + 12, height: 16, labelpos: "c" }
      : {};
    g.setEdge(e.from, e.to, { ...labelDims }, `e${i}`);
  });

  dagre.layout(g);

  const nodes: LaidNode[] = d.nodes.map((n) => {
    const gn = g.node(n.id);
    const s = sizes.get(n.id)!;
    const cx = gn?.x ?? 0;
    const cy = gn?.y ?? 0;
    return { id: n.id, x: cx - s.w / 2, y: cy - s.h / 2, w: s.w, h: s.h, node: n };
  });

  const edges: LaidEdge[] = [];
  d.edges.forEach((e, i) => {
    if (!ids.has(e.from) || !ids.has(e.to)) return;
    const ge = g.edge(e.from, e.to, `e${i}`);
    if (ge?.points?.length) {
      const labelPos =
        e.label && typeof ge.x === "number" && typeof ge.y === "number"
          ? { x: ge.x, y: ge.y }
          : midpoint(ge.points);
      edges.push({ from: e.from, to: e.to, points: ge.points, labelPos, edge: e });
    }
  });

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
// the dagre tiering reads as a meaningless flow.
//
// Quality rules learned from real project maps:
//  • Each BFS subtree owns an angular SECTOR sized by its leaf count, so
//    related nodes cluster near their parent instead of scattering.
//  • Ring radii grow with population (chips can never overlap on a ring).
//  • Edges stop at chip boundaries (arrowheads visible) and non-tree edges
//    bow outward so they don't cut through the hub.
//  • Disconnected nodes form a tidy grid BELOW the map, not a fake outer ring.
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
    if (ids.has(e.from) && ids.has(e.to) && e.from !== e.to) {
      link(e.from, e.to);
      link(e.to, e.from);
    }
  }

  const sizes = new Map<string, { w: number; h: number }>();
  for (const n of nodesIn) sizes.set(n.id, nodeSize(n));

  // Split into connected components. Each component gets its OWN radial cloud
  // (hub = its highest-degree node); a graph with two clusters must not dump
  // the second cluster into a shapeless pile. Degree-0 nodes go to a grid band.
  const isolated = nodesIn.filter((n) => (adj.get(n.id)?.size ?? 0) === 0);
  const visited = new Set<string>(isolated.map((n) => n.id));
  const components: string[][] = [];
  const byDegree = [...nodesIn].sort((a, b) => (adj.get(b.id)?.size ?? 0) - (adj.get(a.id)?.size ?? 0));
  for (const seed of byDegree) {
    if (visited.has(seed.id)) continue;
    const comp: string[] = [];
    const q = [seed.id];
    visited.add(seed.id);
    while (q.length) {
      const cur = q.shift()!;
      comp.push(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          q.push(nb);
        }
      }
    }
    components.push(comp); // seeds iterate by degree, so comp[0] is the hub
  }

  // Lay each component out around its hub, positions relative to that hub.
  const parent = new Map<string, string>(); // global BFS-tree (per component)
  const hubOf = new Map<string, string>(); // node → its component hub
  interface Cloud {
    hub: string;
    members: string[];
    pos: Map<string, { x: number; y: number }>;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }
  const clouds: Cloud[] = [];
  for (const comp of components) {
    const hub = comp[0];
    const level = new Map<string, number>([[hub, 0]]);
    const children = new Map<string, string[]>();
    const queue = [hub];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adj.get(cur) ?? []) {
        if (!level.has(nb)) {
          level.set(nb, level.get(cur)! + 1);
          parent.set(nb, cur);
          let arr = children.get(cur);
          if (!arr) children.set(cur, (arr = []));
          arr.push(nb);
          queue.push(nb);
        }
      }
    }
    for (const id of comp) hubOf.set(id, hub);

    // Angular sectors: each subtree gets a span proportional to its leaf count,
    // so related nodes cluster near their parent instead of scattering.
    const leaves = new Map<string, number>();
    const countLeaves = (id: string): number => {
      const kids = children.get(id) ?? [];
      const c = kids.length === 0 ? 1 : kids.reduce((acc, k) => acc + countLeaves(k), 0);
      leaves.set(id, c);
      return c;
    };
    countLeaves(hub);
    const angle = new Map<string, number>([[hub, 0]]);
    const assignSectors = (id: string, start: number, span: number) => {
      const kids = children.get(id) ?? [];
      if (kids.length === 0) return;
      let cursor = start;
      for (const k of kids) {
        const kSpan = (span * (leaves.get(k) ?? 1)) / (leaves.get(id) ?? 1);
        angle.set(k, cursor + kSpan / 2);
        assignSectors(k, cursor, kSpan);
        cursor += kSpan;
      }
    };
    assignSectors(hub, -Math.PI / 2, Math.PI * 2); // start at 12 o'clock

    // Ring radii sized by population so chips can't collide on a ring.
    let maxLvl = 0;
    for (const v of level.values()) maxLvl = Math.max(maxLvl, v);
    const byLevel = new Map<number, string[]>();
    for (const id of comp) {
      const l = level.get(id)!;
      let arr = byLevel.get(l);
      if (!arr) byLevel.set(l, (arr = []));
      arr.push(id);
    }
    const radius = new Map<number, number>([[0, 0]]);
    for (let l = 1; l <= maxLvl; l++) {
      const ring = byLevel.get(l) ?? [];
      const widthNeeded = ring.reduce((acc, id) => acc + sizes.get(id)!.w + 26, 0);
      const rByPopulation = (widthNeeded * 1.12) / (2 * Math.PI);
      const base = (radius.get(l - 1) ?? 0) + 165;
      radius.set(l, Math.max(base, rByPopulation, l === 1 ? 205 : 0));
    }

    const pos = new Map<string, { x: number; y: number }>([[hub, { x: 0, y: 0 }]]);
    for (const id of comp) {
      if (id === hub) continue;
      const a = angle.get(id) ?? 0;
      const r = radius.get(level.get(id)!) ?? 205;
      pos.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of comp) {
      const p = pos.get(id)!;
      const s = sizes.get(id)!;
      minX = Math.min(minX, p.x - s.w / 2);
      minY = Math.min(minY, p.y - s.h / 2);
      maxX = Math.max(maxX, p.x + s.w / 2);
      maxY = Math.max(maxY, p.y + s.h / 2);
    }
    clouds.push({ hub, members: comp, pos, minX, minY, maxX, maxY });
  }

  // Place clouds left-to-right (largest first), tops aligned, with breathing room.
  const GAP = 130;
  const pos = new Map<string, { x: number; y: number }>();
  let cursorX = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of clouds) {
    const dx = cursorX - c.minX;
    const dy = 0 - c.minY;
    for (const id of c.members) {
      const p = c.pos.get(id)!;
      pos.set(id, { x: p.x + dx, y: p.y + dy });
    }
    minX = Math.min(minX, c.minX + dx);
    minY = Math.min(minY, c.minY + dy);
    maxX = Math.max(maxX, c.maxX + dx);
    maxY = Math.max(maxY, c.maxY + dy);
    cursorX = c.maxX + dx + GAP;
  }
  if (clouds.length === 0) {
    minX = minY = maxX = maxY = 0;
  }

  // Isolated (degree-0) nodes: a tidy grid band below the clouds, not a fake ring.
  if (isolated.length > 0) {
    const cellW = Math.max(...isolated.map((n) => sizes.get(n.id)!.w)) + 22;
    const cellH = Math.max(...isolated.map((n) => sizes.get(n.id)!.h)) + 18;
    const cols = Math.max(1, Math.min(isolated.length, Math.round(Math.sqrt(isolated.length * 2.4))));
    const gridW = cols * cellW;
    const startX = clouds.length ? (minX + maxX) / 2 - gridW / 2 : 0;
    const startY = (clouds.length ? maxY : 0) + 96;
    isolated.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      pos.set(n.id, { x: startX + col * cellW + cellW / 2, y: startY + row * cellH + cellH / 2 });
    });
    for (const n of isolated) {
      const p = pos.get(n.id)!;
      const s = sizes.get(n.id)!;
      minX = Math.min(minX, p.x - s.w / 2);
      minY = Math.min(minY, p.y - s.h / 2);
      maxX = Math.max(maxX, p.x + s.w / 2);
      maxY = Math.max(maxY, p.y + s.h / 2);
    }
  }

  const M = 48; // canvas margin
  const offX = M - minX;
  const offY = M - minY;
  const laidNodes: LaidNode[] = nodesIn.map((n) => {
    const p = pos.get(n.id)!;
    const s = sizes.get(n.id)!;
    return { id: n.id, x: p.x - s.w / 2 + offX, y: p.y - s.h / 2 + offY, w: s.w, h: s.h, node: n };
  });

  const laidById = new Map(laidNodes.map((l) => [l.id, l]));
  const centerOf = (id: string) => {
    const l = laidById.get(id)!;
    return { x: l.x + l.w / 2, y: l.y + l.h / 2 };
  };

  const edges: LaidEdge[] = [];
  for (const e of d.edges) {
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
    const fromNode = laidById.get(e.from)!;
    const toNode = laidById.get(e.to)!;
    const ca = centerOf(e.from);
    const cb = centerOf(e.to);
    const a = trimToRect(ca, cb, fromNode.w, fromNode.h);
    const b = trimToRect(cb, ca, toNode.w, toNode.h);

    // Tree edges (parent↔child) run straight; other relations bow outward so
    // they don't cut through the hub region or underlying chips.
    const isTreeEdge = parent.get(e.to) === e.from || parent.get(e.from) === e.to;
    if (isTreeEdge) {
      edges.push({ from: e.from, to: e.to, points: [a, b], labelPos: midpoint([a, b]), edge: e });
    } else {
      const hubCenter = centerOf(hubOf.get(e.from) ?? e.from);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = mx - hubCenter.x;
      const dy = my - hubCenter.y;
      const dist = Math.hypot(dx, dy) || 1;
      const span = Math.hypot(b.x - a.x, b.y - a.y);
      const push = Math.min(84, 24 + span * 0.18);
      const ctrl = { x: mx + (dx / dist) * push, y: my + (dy / dist) * push };
      edges.push({ from: e.from, to: e.to, points: [a, ctrl, b], labelPos: ctrl, edge: e });
    }
  }

  // Re-measure the full extent (curved control points can poke past chips).
  let w = maxX - minX + 2 * M;
  let h = maxY - minY + 2 * M;
  for (const e of edges) {
    for (const p of e.points) {
      w = Math.max(w, p.x + M);
      h = Math.max(h, p.y + M);
    }
  }
  return { nodes: laidNodes, edges, groups: [], width: w, height: h };
}
