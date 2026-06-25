import { describe, it, expect } from "vitest";
import { layoutDiagram } from "../src/web/lib/layout";
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
