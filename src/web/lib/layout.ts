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

export function layoutDiagram(d: DiagramFile): Layout {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir: d.direction ?? "TB", nodesep: 28, ranksep: 60, marginx: 24, marginy: 24 });
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
