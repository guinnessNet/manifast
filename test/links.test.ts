import { describe, it, expect } from "vitest";
import { buildLinkGraph } from "../src/web/lib/links";
import { workspace, doc, wf } from "./helpers";
import type { Task } from "../src/shared/schema/tasks";

const task = (p: Partial<Task> & { id: string }): Task => ({
  title: p.id,
  status: "todo",
  priority: "med",
  ...p,
});

describe("buildLinkGraph", () => {
  it("indexes docs by both id and uid", () => {
    const ws = workspace({ docs: [doc({ id: "d1", uid: "U1" })] });
    const g = buildLinkGraph(ws);
    expect(g.hasDoc("d1")).toBe(true);
    expect(g.hasDoc("U1")).toBe(true);
    expect(g.docById("U1")?.id).toBe("d1");
    expect(g.hasDoc("missing")).toBe(false);
  });

  it("tasksForSpec unions spec.tasks[] and tasks carrying specId (deduped)", () => {
    const ws = workspace({
      docs: [doc({ id: "spec", tasks: ["t1"] })],
      tasks: {
        path: "t",
        ok: true,
        tasks: [task({ id: "t1", specId: "spec" }), task({ id: "t2", specId: "spec" }), task({ id: "t3" })],
      },
    });
    const ids = buildLinkGraph(ws)
      .tasksForSpec("spec")
      .map((t) => t.id)
      .sort();
    expect(ids).toEqual(["t1", "t2"]);
  });

  it("specsForWireframe finds docs whose frontmatter.wireframe matches", () => {
    const ws = workspace({
      wireframes: [wf({ id: "login" })],
      docs: [doc({ id: "a", wireframe: "login" }), doc({ id: "b", wireframe: "other" })],
    });
    expect(buildLinkGraph(ws).specsForWireframe("login").map((d) => d.id)).toEqual(["a"]);
  });

  it("tasksForWireframe finds tasks whose wireframeId matches", () => {
    const ws = workspace({
      wireframes: [wf({ id: "login" })],
      tasks: { path: "t", ok: true, tasks: [task({ id: "t1", wireframeId: "login" }), task({ id: "t2" })] },
    });
    expect(buildLinkGraph(ws).tasksForWireframe("login").map((t) => t.id)).toEqual(["t1"]);
  });

  it("has(...) predicates report broken links as absent (for greying)", () => {
    const ws = workspace({ wireframes: [wf({ id: "login" })] });
    const g = buildLinkGraph(ws);
    expect(g.hasWireframe("login")).toBe(true);
    expect(g.hasWireframe("ghost")).toBe(false);
  });
});
