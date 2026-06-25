import type { WorkspaceDTO } from "@shared/types";
import type { DiagramFile, DiagramNode, DiagramEdge } from "@shared/schema/diagram";

/**
 * Auto-derive a project relationship map (a Diagram) from the workspace's
 * existing links — docs ↔ wireframes ↔ tasks ↔ plan — with zero agent work.
 * By default, docs with no links are omitted so the graph shows real structure
 * instead of a hairball of isolated nodes; pass includeUnlinkedDocs to show all.
 */
export function buildProjectMap(ws: WorkspaceDTO, includeUnlinkedDocs = false): DiagramFile {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  // A doc is "linked" if it points at / is pointed at by another item.
  const linked = linkedDocIds(ws);

  for (const d of ws.items.docs) {
    if (!includeUnlinkedDocs && !linked.has(d.id)) continue;
    nodes.push({ id: `doc:${d.id}`, label: d.title, group: "docs", kind: "doc", ref: { kind: "doc", id: d.id } });
  }
  for (const w of ws.items.wireframes) {
    nodes.push({ id: `wf:${w.id}`, label: w.name, group: "wireframes", kind: "wireframe", ref: { kind: "wireframe", id: w.id } });
  }
  for (const t of ws.items.tasks?.tasks ?? []) {
    nodes.push({ id: `task:${t.id}`, label: t.title, group: "tasks", kind: "task", ref: { kind: "task", id: t.id } });
  }
  for (const p of ws.items.plan?.phases ?? []) {
    nodes.push({ id: `phase:${p.id}`, label: p.name, group: "plan", kind: "phase" });
  }

  const has = new Set(nodes.map((n) => n.id));
  const add = (from: string, to: string, kind: string, label?: string) => {
    if (has.has(from) && has.has(to)) edges.push({ from, to, kind, label });
  };

  const docIdByKey = docKeyResolver(ws);
  for (const d of ws.items.docs) {
    if (d.wireframe) add(`doc:${d.id}`, `wf:${d.wireframe}`, "links");
    for (const tid of d.tasks ?? []) add(`doc:${d.id}`, `task:${tid}`, "links");
    if (d.deprecatedBy) add(`doc:${d.id}`, `doc:${docIdByKey(d.deprecatedBy) ?? d.deprecatedBy}`, "deprecatedBy", "→");
    for (const rel of d.related ?? []) {
      const r = docIdByKey(rel);
      if (r && r !== d.id) add(`doc:${d.id}`, `doc:${r}`, "related", "~");
    }
  }
  for (const t of ws.items.tasks?.tasks ?? []) {
    if (t.specId) add(`task:${t.id}`, `doc:${t.specId}`, "spec");
    if (t.wireframeId) add(`task:${t.id}`, `wf:${t.wireframeId}`, "screen");
    for (const dep of t.deps ?? []) add(`task:${t.id}`, `task:${dep}`, "dep");
  }
  for (const p of ws.items.plan?.phases ?? []) {
    for (const tid of p.taskIds ?? []) add(`phase:${p.id}`, `task:${tid}`, "task");
  }

  // `sources` overlap → chain shown docs that share a code path (avoids an n²
  // hairball while still giving source-linked docs a visible connection).
  const shownDocBySource = new Map<string, string[]>();
  for (const d of ws.items.docs) {
    if (!has.has(`doc:${d.id}`)) continue;
    for (const s of d.sources ?? []) {
      const arr = shownDocBySource.get(s);
      if (arr) arr.push(d.id);
      else shownDocBySource.set(s, [d.id]);
    }
  }
  const sourceEdgeSeen = new Set<string>();
  for (const ids of shownDocBySource.values()) {
    for (let i = 1; i < ids.length; i++) {
      const key = `${ids[i - 1]}|${ids[i]}`;
      if (sourceEdgeSeen.has(key)) continue;
      sourceEdgeSeen.add(key);
      add(`doc:${ids[i - 1]}`, `doc:${ids[i]}`, "source", "src");
    }
  }

  return {
    schema: "manifast.diagram/1",
    id: "__project__",
    title: "Project map (auto)",
    kind: "docmap",
    direction: "LR",
    groups: [
      { id: "docs", label: "Docs" },
      { id: "wireframes", label: "Wireframes" },
      { id: "tasks", label: "Tasks" },
      { id: "plan", label: "Plan" },
    ],
    nodes,
    edges,
  };
}

/** Resolve a doc reference (by id OR uid) to its canonical doc id. */
function docKeyResolver(ws: WorkspaceDTO): (key: string) => string | undefined {
  const byKey = new Map<string, string>();
  for (const d of ws.items.docs) {
    byKey.set(d.id, d.id);
    if (d.uid) byKey.set(d.uid, d.id);
  }
  return (key) => byKey.get(key);
}

/**
 * Doc ids that participate in any relationship (so they aren't orphans).
 * Counts, in both directions: frontmatter wireframe/tasks/deprecatedBy/`related`,
 * a task's specId, and `sources` overlap (docs describing the same code path).
 */
function linkedDocIds(ws: WorkspaceDTO): Set<string> {
  const linked = new Set<string>();
  const resolve = docKeyResolver(ws);

  for (const d of ws.items.docs) {
    if (d.wireframe || (d.tasks && d.tasks.length > 0) || d.deprecatedBy || (d.related && d.related.length > 0)) {
      linked.add(d.id);
    }
    if (d.deprecatedBy) {
      const r = resolve(d.deprecatedBy);
      if (r) linked.add(r);
    }
    for (const rel of d.related ?? []) {
      const r = resolve(rel);
      if (r) {
        linked.add(r);
        linked.add(d.id);
      }
    }
  }
  for (const t of ws.items.tasks?.tasks ?? []) {
    if (t.specId) linked.add(resolve(t.specId) ?? t.specId);
  }

  // `sources` overlap: docs describing the same code path are related.
  const docsBySource = new Map<string, string[]>();
  for (const d of ws.items.docs) {
    for (const s of d.sources ?? []) {
      const arr = docsBySource.get(s);
      if (arr) arr.push(d.id);
      else docsBySource.set(s, [d.id]);
    }
  }
  for (const ids of docsBySource.values()) {
    if (ids.length > 1) for (const id of ids) linked.add(id);
  }

  return linked;
}

/** Docs with no links in or out (orphans) — for the Map's orphans panel. */
export function getOrphanDocs(ws: WorkspaceDTO): { id: string; title: string; path: string }[] {
  const linked = linkedDocIds(ws);
  return ws.items.docs
    .filter((d) => !linked.has(d.id))
    .map((d) => ({ id: d.id, title: d.title, path: d.path }));
}

/** Node ids within `depth` undirected hops of `start` (focus/neighborhood mode). */
export function getNeighborhood(d: DiagramFile, start: string, depth: number): Set<string> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set());
    adj.get(a)!.add(b);
  };
  for (const e of d.edges) {
    link(e.from, e.to);
    link(e.to, e.from);
  }
  const seen = new Set<string>([start]);
  let frontier = [start];
  for (let i = 0; i < depth; i++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
  }
  return seen;
}

/** Restrict a diagram to a set of node ids (+ edges/groups among them). */
export function filterDiagram(d: DiagramFile, keep: Set<string>): DiagramFile {
  const nodes = d.nodes.filter((n) => keep.has(n.id));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = d.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const used = new Set(nodes.map((n) => n.group).filter((g): g is string => !!g));
  return { ...d, nodes, edges, groups: (d.groups ?? []).filter((g) => used.has(g.id)) };
}
