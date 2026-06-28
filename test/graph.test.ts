import { describe, it, expect } from "vitest";
import { buildProjectMap, getOrphanDocs, getNeighborhood, filterDiagram } from "../src/web/lib/graph";
import type { DiagramFile } from "../src/shared/schema/diagram";
import { workspace, doc, wf } from "./helpers";

describe("getOrphanDocs / linkedDocIds", () => {
  it("treats a lone doc with no links as an orphan", () => {
    const ws = workspace({ docs: [doc({ id: "alone" })] });
    expect(getOrphanDocs(ws).map((d) => d.id)).toEqual(["alone"]);
  });

  it("links docs via `related` in BOTH directions", () => {
    const ws = workspace({ docs: [doc({ id: "a", related: ["b"] }), doc({ id: "b" })] });
    expect(getOrphanDocs(ws)).toHaveLength(0); // both a and b are linked
  });

  it("resolves `related` by uid as well as id", () => {
    const ws = workspace({
      docs: [doc({ id: "a", related: ["UID-B"] }), doc({ id: "b", uid: "UID-B" })],
    });
    expect(getOrphanDocs(ws)).toHaveLength(0);
  });

  it("does NOT link a doc whose `related` points at a non-existent target", () => {
    const ws = workspace({ docs: [doc({ id: "a", related: ["ghost"] }), doc({ id: "b" })] });
    // `a` declared a relationship so it counts as linked; `b` is a true orphan.
    const orphans = getOrphanDocs(ws).map((d) => d.id);
    expect(orphans).toEqual(["b"]);
  });

  it("links docs that share a `sources` code path (overlap)", () => {
    const ws = workspace({
      docs: [doc({ id: "a", sources: ["src/auth.ts"] }), doc({ id: "b", sources: ["src/auth.ts"] })],
    });
    expect(getOrphanDocs(ws)).toHaveLength(0);
  });

  it("does NOT link docs with disjoint sources", () => {
    const ws = workspace({
      docs: [doc({ id: "a", sources: ["src/a.ts"] }), doc({ id: "b", sources: ["src/b.ts"] })],
    });
    expect(getOrphanDocs(ws).map((d) => d.id).sort()).toEqual(["a", "b"]);
  });

  it("links a doc referenced by a task's specId", () => {
    const ws = workspace({
      docs: [doc({ id: "spec-1" })],
      tasks: { path: "t", ok: true, tasks: [{ id: "t1", title: "T", status: "todo", specId: "spec-1" }] },
    });
    expect(getOrphanDocs(ws)).toHaveLength(0);
  });

  it("links a doc that points at a wireframe or tasks", () => {
    const ws = workspace({
      docs: [doc({ id: "a", wireframe: "login" }), doc({ id: "b", tasks: ["t1"] })],
    });
    expect(getOrphanDocs(ws)).toHaveLength(0);
  });
});

describe("buildProjectMap", () => {
  it("hides unlinked docs by default and shows them when asked", () => {
    const ws = workspace({ docs: [doc({ id: "lonely" })] });
    expect(buildProjectMap(ws).nodes.find((n) => n.id === "doc:lonely")).toBeUndefined();
    expect(buildProjectMap(ws, true).nodes.find((n) => n.id === "doc:lonely")).toBeDefined();
  });

  it("draws a doc↔doc `related` edge between shown docs", () => {
    const ws = workspace({ docs: [doc({ id: "a", related: ["b"] }), doc({ id: "b" })] });
    const m = buildProjectMap(ws);
    const e = m.edges.find((x) => x.from === "doc:a" && x.to === "doc:b");
    expect(e?.kind).toBe("related");
  });

  it("never creates a self-edge from `related` pointing at itself", () => {
    const ws = workspace({ docs: [doc({ id: "a", uid: "UA", related: ["UA"] }), doc({ id: "b", related: ["a"] })] });
    const m = buildProjectMap(ws);
    expect(m.edges.some((e) => e.from === e.to)).toBe(false);
  });

  it("draws a chained `source` edge for docs sharing a code path (no n^2, no dupes)", () => {
    const ws = workspace({
      docs: [
        doc({ id: "a", sources: ["src/x.ts"] }),
        doc({ id: "b", sources: ["src/x.ts"] }),
        doc({ id: "c", sources: ["src/x.ts"] }),
      ],
    });
    const m = buildProjectMap(ws);
    const sourceEdges = m.edges.filter((e) => e.kind === "source");
    // chain a-b, b-c — exactly 2 edges, not 3 (no a-c), not duplicated.
    expect(sourceEdges).toHaveLength(2);
    const keys = sourceEdges.map((e) => `${e.from}->${e.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("aggregate: collapses docs into dir:<folder> super-nodes with counts and rolled-up edges", () => {
    const ws = workspace({
      docs: [
        doc({ id: "a", path: "docs/specs/a.md", related: ["b"] }),
        doc({ id: "b", path: "docs/specs/b.md" }),
        doc({ id: "c", path: "docs/c.md", related: ["a"] }),
      ],
    });
    const m = buildProjectMap(ws, false, true);
    const ids = m.nodes.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(["dir:docs/specs", "dir:docs"]));
    expect(ids.some((i) => i.startsWith("doc:"))).toBe(false); // every doc collapsed
    const specs = m.nodes.find((n) => n.id === "dir:docs/specs")!;
    expect(specs.kind).toBe("folder");
    expect(specs.label).toContain("(2)"); // a + b
    expect(m.edges.some((e) => e.from === e.to)).toBe(false); // intra-folder a↔b self-loop dropped
    // cross-folder related edge (docs/c → docs/specs/a) survives, remapped onto folders.
    expect(m.edges.some((e) => e.from === "dir:docs" && e.to === "dir:docs/specs")).toBe(true);
  });

  it("aggregate: collapses tasks into their plan phase (with task count) and rewires phase→folder", () => {
    const ws = workspace({
      docs: [doc({ id: "spec", path: "docs/specs/spec.md" })],
      tasks: { path: "t", ok: true, tasks: [{ id: "t1", title: "T", status: "todo", specId: "spec" }] },
      plan: { path: "p", ok: true, phases: [{ id: "ph1", name: "P1", status: "planned", taskIds: ["t1"] }] },
    });
    const m = buildProjectMap(ws, false, true);
    const ids = m.nodes.map((n) => n.id);
    expect(ids.some((i) => i.startsWith("task:"))).toBe(false); // tasks rolled into phase
    expect(ids).toEqual(expect.arrayContaining(["phase:ph1", "dir:docs/specs"]));
    expect(m.nodes.find((n) => n.id === "phase:ph1")!.label).toContain("1 tasks");
    // phase→task→doc:spec chain becomes phase→folder.
    expect(m.edges.some((e) => e.from === "phase:ph1" && e.to === "dir:docs/specs")).toBe(true);
  });

  it("includes wireframe, task and phase nodes with link edges", () => {
    const ws = workspace({
      wireframes: [wf({ id: "login" })],
      docs: [doc({ id: "spec", wireframe: "login" })],
      tasks: { path: "t", ok: true, tasks: [{ id: "t1", title: "T", status: "todo", specId: "spec" }] },
      plan: { path: "p", ok: true, phases: [{ id: "ph1", name: "P1", status: "planned", taskIds: ["t1"] }] },
    });
    const m = buildProjectMap(ws);
    expect(m.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining(["wf:login", "doc:spec", "task:t1", "phase:ph1"]),
    );
    expect(m.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "doc:spec", to: "wf:login", kind: "links" }),
        expect.objectContaining({ from: "task:t1", to: "doc:spec", kind: "spec" }),
        expect.objectContaining({ from: "phase:ph1", to: "task:t1", kind: "task" }),
      ]),
    );
  });
});

describe("getNeighborhood / filterDiagram", () => {
  const d: DiagramFile = {
    schema: "manifast.diagram/1",
    id: "g",
    title: "g",
    kind: "diagram",
    groups: [{ id: "g1", label: "G1" }],
    nodes: [
      { id: "a", label: "a", group: "g1" },
      { id: "b", label: "b", group: "g1" },
      { id: "c", label: "c" },
      { id: "d", label: "d" },
    ],
    edges: [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
      { from: "c", to: "d" },
    ],
  };

  it("returns nodes within N undirected hops", () => {
    expect([...getNeighborhood(d, "a", 1)].sort()).toEqual(["a", "b"]);
    expect([...getNeighborhood(d, "a", 2)].sort()).toEqual(["a", "b", "c"]);
    expect([...getNeighborhood(d, "b", 1)].sort()).toEqual(["a", "b", "c"]);
  });

  it("restricts a diagram to the kept node set and prunes orphaned edges + groups", () => {
    const keep = getNeighborhood(d, "a", 1); // {a, b}
    const f = filterDiagram(d, keep);
    expect(f.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(f.edges).toEqual([{ from: "a", to: "b" }]);
    expect(f.groups).toEqual([{ id: "g1", label: "G1" }]);
  });

  it("drops a group with no surviving nodes", () => {
    const f = filterDiagram(d, new Set(["c", "d"]));
    expect(f.groups).toEqual([]);
    expect(f.edges).toEqual([{ from: "c", to: "d" }]);
  });
});
