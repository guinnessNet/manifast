import type { WorkspaceDTO } from "@shared/types";
import type { DiagramFile, DiagramNode, DiagramEdge } from "@shared/schema/diagram";

/**
 * Auto-derive a project relationship map (a Diagram) from the workspace's
 * existing links — docs ↔ wireframes ↔ tasks ↔ plan — with zero agent work.
 * By default, docs with no links are omitted so the graph shows real structure
 * instead of a hairball of isolated nodes; pass includeUnlinkedDocs to show all.
 */
export function buildProjectMap(ws: WorkspaceDTO, includeUnlinkedDocs = false, aggregateDocs = false): DiagramFile {
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
  const docIdByPath = new Map(ws.items.docs.map((d) => [d.path, d.id]));
  for (const d of ws.items.docs) {
    if (d.wireframe) add(`doc:${d.id}`, `wf:${d.wireframe}`, "links");
    for (const tid of d.tasks ?? []) add(`doc:${d.id}`, `task:${tid}`, "links");
    if (d.deprecatedBy) add(`doc:${d.id}`, `doc:${docIdByKey(d.deprecatedBy) ?? d.deprecatedBy}`, "deprecatedBy");
    for (const rel of d.related ?? []) {
      const r = docIdByKey(rel);
      if (r && r !== d.id) add(`doc:${d.id}`, `doc:${r}`, "related");
    }
    // Markdown-body links (server-extracted) — the relations real docs already
    // have without any frontmatter wiring.
    for (const lp of d.links ?? []) {
      const r = docIdByPath.get(lp);
      if (r && r !== d.id) add(`doc:${d.id}`, `doc:${r}`, "references");
    }
  }
  for (const t of ws.items.tasks?.tasks ?? []) {
    // Resolve specId through the same id/uid resolver as `related` — a task
    // referencing a spec by uid must still produce a visible edge.
    if (t.specId) add(`task:${t.id}`, `doc:${docIdByKey(t.specId) ?? t.specId}`, "spec");
    if (t.wireframeId) add(`task:${t.id}`, `wf:${t.wireframeId}`, "screen");
    for (const dep of t.deps ?? []) add(`task:${t.id}`, `task:${dep}`, "dep");
  }
  for (const p of ws.items.plan?.phases ?? []) {
    for (const tid of p.taskIds ?? []) add(`phase:${p.id}`, `task:${tid}`, "task");
  }

  // `sources` overlap → chain shown docs that share a code path (avoids an n²
  // hairball while still giving source-linked docs a visible connection).
  // Added BEFORE the dedupe pass so "references" edges can yield to them.
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
      add(`doc:${ids[i - 1]}`, `doc:${ids[i]}`, "source");
    }
  }

  // Reciprocal doc↔task declarations (spec `tasks:[…]` + task `specId`) would
  // otherwise draw two overlapping edges per pair — keep the task→doc "spec"
  // edge and drop the mirror. A body-link "references" edge likewise yields to
  // any stronger authored relation between the same docs. Then drop exact dupes.
  const specPairs = new Set(
    edges.filter((e) => e.kind === "spec").map((e) => `${e.to}|${e.from}`),
  );
  const strongDocPairs = new Set(
    edges
      .filter((e) => e.kind === "related" || e.kind === "deprecatedBy" || e.kind === "source")
      .flatMap((e) => [`${e.from}|${e.to}`, `${e.to}|${e.from}`]),
  );
  const seenEdge = new Set<string>();
  const seenRefPair = new Set<string>();
  const deduped = edges.filter((e) => {
    if (e.kind === "links" && specPairs.has(`${e.from}|${e.to}`)) return false;
    if (e.kind === "references") {
      if (strongDocPairs.has(`${e.from}|${e.to}`)) return false;
      // A→B and B→A body references collapse into one line.
      if (seenRefPair.has(`${e.to}|${e.from}`)) return false;
      seenRefPair.add(`${e.from}|${e.to}`);
    }
    const key = `${e.from}|${e.to}|${e.kind}`;
    if (seenEdge.has(key)) return false;
    seenEdge.add(key);
    return true;
  });
  edges.length = 0;
  edges.push(...deduped);

  const map: DiagramFile = {
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

  // At scale (e.g. 150+ docs) one-node-per-doc is an unreadable hairball. Collapse
  // docs into folder super-nodes and tasks into their phase, so the map reads as a
  // ~dozen-node structure overview. The "Expand docs" toggle returns to full.
  return aggregateDocs ? aggregateOverview(map, ws) : map;
}

/** Immediate parent folder of a repo-relative path ("docs/specs/x.md" → "docs/specs"). */
function folderOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i < 0 ? "(root)" : path.slice(0, i);
}

/**
 * Structure-overview aggregation: collapse each `doc:<id>` into a `dir:<folder>`
 * super-node (with a count), each `task:<id>` into its `phase:<id>` (phase labelled
 * with a task count), and drop standalone wireframe/task chips. Edges are remapped
 * onto the survivors, with self-loops dropped and duplicates merged. A 150-doc +
 * 17-task hairball becomes ~a dozen folder/phase nodes that read as real structure.
 */
function aggregateOverview(map: DiagramFile, ws: WorkspaceDTO): DiagramFile {
  const folderByDocId = new Map<string, string>();
  for (const d of ws.items.docs) folderByDocId.set(d.id, folderOf(d.path));
  const phaseByTaskId = new Map<string, string>();
  const taskCountByPhase = new Map<string, number>();
  for (const p of ws.items.plan?.phases ?? []) {
    for (const tid of p.taskIds ?? []) {
      phaseByTaskId.set(tid, p.id);
      taskCountByPhase.set(p.id, (taskCountByPhase.get(p.id) ?? 0) + 1);
    }
  }

  // Map any original node id onto its survivor (or null = dropped).
  const remap = (nodeId: string): string | null => {
    if (nodeId.startsWith("doc:")) return `dir:${folderByDocId.get(nodeId.slice(4)) ?? "(root)"}`;
    if (nodeId.startsWith("task:")) {
      const ph = phaseByTaskId.get(nodeId.slice(5));
      return ph ? `phase:${ph}` : null; // unphased tasks drop out of the overview
    }
    if (nodeId.startsWith("wf:")) return null;
    return nodeId; // phase:* (and any other) pass through
  };

  const folderCount = new Map<string, number>();
  for (const n of map.nodes) {
    if (n.id.startsWith("doc:")) {
      const fid = remap(n.id)!;
      folderCount.set(fid, (folderCount.get(fid) ?? 0) + 1);
    }
  }
  const folderNodes: DiagramNode[] = [...folderCount].map(([fid, c]) => ({
    id: fid,
    label: `${fid.slice(4)} (${c})`,
    group: "docs",
    kind: "folder",
  }));
  const phaseNodes: DiagramNode[] = map.nodes
    .filter((n) => n.id.startsWith("phase:"))
    .map((n) => {
      const c = taskCountByPhase.get(n.id.slice(6)) ?? 0;
      return { ...n, label: c ? `${n.label} · ${c} tasks` : n.label };
    });
  const nodes = [...folderNodes, ...phaseNodes];
  const ids = new Set(nodes.map((n) => n.id));

  const seen = new Set<string>();
  const edges: DiagramEdge[] = [];
  for (const e of map.edges) {
    const from = remap(e.from);
    const to = remap(e.to);
    if (!from || !to || from === to || !ids.has(from) || !ids.has(to)) continue;
    const key = `${from}|${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to, kind: e.kind });
  }

  return { ...map, nodes, edges };
}

/**
 * Resolve a doc reference to its canonical doc id. Accepts id, uid, project-root
 * path ("docs/setup.md") and filename stem ("setup") — agents naturally author
 * any of these in `related`, and a silently dropped edge is exactly the
 * "relations not drawn" complaint. id/uid take precedence over path/stem.
 */
export function docKeyResolver(ws: WorkspaceDTO): (key: string) => string | undefined {
  const byKey = new Map<string, string>();
  for (const d of ws.items.docs) {
    byKey.set(d.path, d.id);
    const stem = d.path.slice(d.path.lastIndexOf("/") + 1).replace(/\.(md|markdown)$/i, "");
    if (stem && !byKey.has(stem)) byKey.set(stem, d.id);
  }
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
  const byPath = new Map(ws.items.docs.map((d) => [d.path, d.id]));

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
    // Markdown-body links count in both directions (only when the target exists).
    for (const lp of d.links ?? []) {
      const r = byPath.get(lp);
      if (r && r !== d.id) {
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

/** Docs with no links in or out (orphans) — for the Map's orphans panel.
    Root instruction files (README/CLAUDE/AGENTS) are exempt: the skill forbids
    adding manifast frontmatter to them, so they'd otherwise be permanent
    orphans keeping the warning badge lit on every project. */
export function getOrphanDocs(ws: WorkspaceDTO): { id: string; title: string; path: string }[] {
  const linked = linkedDocIds(ws);
  return ws.items.docs
    .filter((d) => !linked.has(d.id) && d.path.includes("/"))
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
