import { describe, it, expect } from "vitest";
import { layoutDiagram, resolveLayout } from "../src/web/lib/layout";
import type { DiagramFile } from "../src/shared/schema/diagram";

const base = (direction?: DiagramFile["direction"]): DiagramFile => ({
  schema: "manifast.diagram/1",
  id: "g",
  title: "g",
  kind: "diagram",
  direction,
  groups: [{ id: "grp", label: "Group" }],
  nodes: [
    { id: "a", label: "Node A", group: "grp" },
    { id: "b", label: "Node B", group: "grp" },
    { id: "c", label: "Node C" },
  ],
  edges: [
    { from: "a", to: "b" },
    { from: "b", to: "c" },
  ],
});

describe("layoutDiagram", () => {
  it("returns positioned nodes, edges with points, and overall dimensions", () => {
    const l = layoutDiagram(base("TB"));
    expect(l.nodes).toHaveLength(3);
    for (const n of l.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.w).toBeGreaterThan(0);
      expect(n.h).toBeGreaterThan(0);
    }
    expect(l.edges).toHaveLength(2);
    for (const e of l.edges) expect(e.points.length).toBeGreaterThanOrEqual(2);
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
  });

  it("lays groups out as bounding boxes", () => {
    const l = layoutDiagram(base("TB"));
    expect(l.groups.map((g) => g.id)).toContain("grp");
    const grp = l.groups.find((g) => g.id === "grp")!;
    expect(grp.w).toBeGreaterThan(0);
    expect(grp.h).toBeGreaterThan(0);
  });

  it("honors layout direction (TB taller, LR wider for a chain)", () => {
    const tb = layoutDiagram(base("TB"));
    const lr = layoutDiagram(base("LR"));
    // A 3-node chain stacks vertically in TB and horizontally in LR.
    expect(tb.height).toBeGreaterThan(lr.height);
    expect(lr.width).toBeGreaterThan(tb.width);
  });

  it("ignores edges that reference missing nodes", () => {
    const d = base("TB");
    d.edges.push({ from: "a", to: "ghost" });
    const l = layoutDiagram(d);
    expect(l.edges).toHaveLength(2);
  });
});

describe("resolveLayout", () => {
  const mk = (kind: string, layout?: DiagramFile["layout"]): DiagramFile => ({
    schema: "manifast.diagram/1",
    id: "d",
    title: "d",
    kind,
    layout,
    nodes: [],
    edges: [],
  });

  it("infers radial for relationship kinds, tree for hierarchy kinds, layered otherwise", () => {
    expect(resolveLayout(mk("docmap"))).toBe("radial");
    expect(resolveLayout(mk("mindmap"))).toBe("radial");
    expect(resolveLayout(mk("sitemap"))).toBe("tree");
    expect(resolveLayout(mk("architecture"))).toBe("layered");
    expect(resolveLayout(mk("flow"))).toBe("layered");
    expect(resolveLayout(mk("diagram"))).toBe("layered");
  });

  it("lets an explicit `layout` override the kind inference", () => {
    expect(resolveLayout(mk("architecture", "radial"))).toBe("radial");
    expect(resolveLayout(mk("docmap", "layered"))).toBe("layered");
  });
});

describe("radial layout (mind map)", () => {
  const docmap: DiagramFile = {
    schema: "manifast.diagram/1",
    id: "m",
    title: "m",
    kind: "docmap", // → radial
    groups: [{ id: "grp", label: "Group" }],
    nodes: [
      { id: "hub", label: "Hub", group: "grp" },
      { id: "a", label: "Node A" },
      { id: "b", label: "Node B" },
      { id: "c", label: "Node C" },
    ],
    edges: [
      { from: "hub", to: "a" },
      { from: "hub", to: "b" },
      { from: "hub", to: "c" },
    ],
  };

  it("positions every node, draws center-to-center edges, and emits no group boxes", () => {
    const l = layoutDiagram(docmap);
    expect(l.nodes).toHaveLength(4);
    for (const n of l.nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.w).toBeGreaterThan(0);
      expect(n.h).toBeGreaterThan(0);
    }
    // A mind map is hub-centric — cluster boxes are intentionally not drawn.
    expect(l.groups).toHaveLength(0);
    expect(l.edges).toHaveLength(3);
    for (const e of l.edges) expect(e.points).toHaveLength(2);
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
  });

  it("places the highest-degree node (hub) inside the satellite ring", () => {
    const l = layoutDiagram(docmap);
    const byId = new Map(l.nodes.map((n) => [n.id, n]));
    const cx = (id: string) => byId.get(id)!.x + byId.get(id)!.w / 2;
    const cy = (id: string) => byId.get(id)!.y + byId.get(id)!.h / 2;
    const hub = { x: cx("hub"), y: cy("hub") };
    // Hub sits at the centroid; each satellite is strictly farther from it than the hub's own offset.
    const sat = ["a", "b", "c"].map((id) => Math.hypot(cx(id) - hub.x, cy(id) - hub.y));
    for (const d of sat) expect(d).toBeGreaterThan(100);
  });
});
