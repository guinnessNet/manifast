import type { WorkspaceDTO, WireframeMeta, DocMeta } from "@shared/types";
import type { Task } from "@shared/schema/tasks";

export interface LinkGraph {
  hasWireframe: (id: string) => boolean;
  hasDoc: (id: string) => boolean;
  hasTask: (id: string) => boolean;
  wireframeById: (id: string) => WireframeMeta | undefined;
  docById: (id: string) => DocMeta | undefined;
  taskById: (id: string) => Task | undefined;
  /** Tasks linked to a spec: union of spec.tasks[] and tasks with specId. */
  tasksForSpec: (specId: string) => Task[];
  /** Specs that point at a wireframe via frontmatter.wireframe. */
  specsForWireframe: (wfId: string) => DocMeta[];
  /** Tasks that point at a wireframe via wireframeId. */
  tasksForWireframe: (wfId: string) => Task[];
}

export function buildLinkGraph(ws: WorkspaceDTO): LinkGraph {
  const docs = ws.items.docs;
  const tasks = ws.items.tasks?.tasks ?? [];

  const wfById = new Map(ws.items.wireframes.map((w) => [w.id, w]));
  // Index docs by both human id and stable uid so links resolve either way.
  const docById = new Map<string, DocMeta>();
  for (const d of docs) {
    docById.set(d.id, d);
    if (d.uid) docById.set(d.uid, d);
  }
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  return {
    hasWireframe: (id) => wfById.has(id),
    hasDoc: (id) => docById.has(id),
    hasTask: (id) => taskById.has(id),
    wireframeById: (id) => wfById.get(id),
    docById: (id) => docById.get(id),
    taskById: (id) => taskById.get(id),
    tasksForSpec: (specId) => {
      const spec = docById.get(specId);
      const ids = new Set<string>(spec?.tasks ?? []);
      for (const t of tasks) if (t.specId === specId) ids.add(t.id);
      return [...ids].map((id) => taskById.get(id)).filter((t): t is Task => !!t);
    },
    specsForWireframe: (wfId) => docs.filter((d) => d.wireframe === wfId),
    tasksForWireframe: (wfId) => tasks.filter((t) => t.wireframeId === wfId),
  };
}
