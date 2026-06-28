import { existsSync } from "node:fs";
import { readWorkspace, readFileResource } from "../server/workspace";
import { confine } from "../server/safePath";

// `manifast validate` — an LLM-agnostic gate. Any agent (Claude, Codex, …) can
// author files; this re-parses the workspace through the same zod schemas the
// app uses and checks cross-references, so bad output fails loudly (nonzero
// exit) instead of being silently ingested.

export interface ValidateIssue {
  level: "error" | "warning";
  path: string;
  message: string;
}

export interface ValidateReport {
  issues: ValidateIssue[];
  ok: boolean; // no errors (warnings don't flip this; `--strict` is applied by the caller)
  counts: { wireframes: number; docs: number; tasks: number; diagrams: number; phases: number };
}

function dupCheck(
  pairs: Array<[id: string, path: string]>,
  label: string,
  report: (path: string, message: string) => void,
): void {
  const freq = new Map<string, number>();
  for (const [id] of pairs) freq.set(id, (freq.get(id) ?? 0) + 1);
  const flagged = new Set<string>();
  for (const [id, p] of pairs) {
    if ((freq.get(id) ?? 0) > 1 && !flagged.has(id)) {
      report(p, `duplicate ${label}: "${id}"`);
      flagged.add(id);
    }
  }
}

export async function validateWorkspace(manifastDir: string, projectDir: string): Promise<ValidateReport> {
  const ws = await readWorkspace(manifastDir, projectDir);
  const issues: ValidateIssue[] = [];
  const err = (path: string, message: string) => issues.push({ level: "error", path, message });
  const warn = (path: string, message: string) => issues.push({ level: "warning", path, message });

  const tasksFile = ws.items.tasks;
  const planFile = ws.items.plan;
  const tasks = tasksFile?.tasks ?? [];

  // 1. Schema / parse failures, taken straight from the parsed items (NOT from
  //    ws.errors, which folds doc warnings in as errors and would double-count
  //    the per-item failures below).
  for (const w of ws.items.wireframes) if (!w.ok && w.error) err(w.path, w.error);
  for (const d of ws.items.diagrams) if (!d.ok && d.error) err(d.path, d.error);
  if (tasksFile && !tasksFile.ok && tasksFile.error) err(tasksFile.path, tasksFile.error);
  if (planFile && !planFile.ok && planFile.error) err(planFile.path, planFile.error);
  for (const d of ws.items.docs) {
    if (!d.ok && d.error) err(d.path, d.error);
    else if (d.warning) warn(d.path, `frontmatter: ${d.warning}`); // a doc fails hard OR warns, not both
  }

  // 2. Duplicate ids (authored JSON ids must be unique; doc ids may be inferred
  //    from filenames, so a clash there is a warning rather than an error).
  dupCheck(ws.items.wireframes.map((w) => [w.id, w.path]), "wireframe id", err);
  dupCheck(ws.items.diagrams.map((d) => [d.id, d.path]), "diagram id", err);
  if (tasksFile) dupCheck(tasks.map((t) => [t.id, tasksFile.path]), "task id", err);
  if (planFile) dupCheck(planFile.phases.map((p) => [p.id, planFile.path]), "phase id", err);
  dupCheck(ws.items.docs.map((d) => [d.id, d.path]), "doc id", warn);

  // 3. Broken cross-references.
  const wfIds = new Set(ws.items.wireframes.map((w) => w.id));
  const taskIds = new Set(tasks.map((t) => t.id));
  const docIds = new Set<string>();
  for (const d of ws.items.docs) {
    docIds.add(d.id);
    if (d.uid) docIds.add(d.uid);
  }

  for (const d of ws.items.docs) {
    if (d.wireframe && !wfIds.has(d.wireframe)) err(d.path, `broken link: wireframe "${d.wireframe}" not found`);
    for (const t of d.tasks ?? []) if (!taskIds.has(t)) err(d.path, `broken link: task "${t}" not found`);
    for (const r of d.related ?? []) if (!docIds.has(r)) err(d.path, `broken link: related doc "${r}" not found`);
    if (d.deprecatedBy && !docIds.has(d.deprecatedBy))
      err(d.path, `broken link: deprecatedBy doc "${d.deprecatedBy}" not found`);
  }
  if (tasksFile) {
    for (const t of tasks) {
      if (t.specId && !docIds.has(t.specId)) err(tasksFile.path, `task "${t.id}": spec "${t.specId}" not found`);
      if (t.wireframeId && !wfIds.has(t.wireframeId)) err(tasksFile.path, `task "${t.id}": wireframe "${t.wireframeId}" not found`);
      for (const dep of t.deps ?? []) if (!taskIds.has(dep)) err(tasksFile.path, `task "${t.id}": dep "${dep}" not found`);
    }
  }
  if (planFile) {
    for (const p of planFile.phases) {
      for (const tid of p.taskIds ?? []) if (!taskIds.has(tid)) err(planFile.path, `phase "${p.id}": task "${tid}" not found`);
    }
  }

  // 4. Diagram integrity — edges must connect real nodes, node.group must exist,
  //    and node.ref must resolve (incl. `path` refs, which point at a file that
  //    must exist inside the project root). The DTO only carries diagram counts,
  //    so re-read each parsed diagram for its graph.
  for (const dg of ws.items.diagrams) {
    if (!dg.ok) continue;
    const resp = await readFileResource(projectDir, dg.path);
    if (resp.kind !== "diagram" || !resp.ok || !resp.data) continue;
    const data = resp.data;
    const nodeIds = new Set(data.nodes.map((n) => n.id));
    const groupIds = new Set((data.groups ?? []).map((g) => g.id));
    dupCheck(data.nodes.map((n) => [n.id, dg.path]), "diagram node id", err);
    for (const e of data.edges) {
      if (!nodeIds.has(e.from)) err(dg.path, `edge from "${e.from}" → no such node`);
      if (!nodeIds.has(e.to)) err(dg.path, `edge to "${e.to}" → no such node`);
    }
    for (const n of data.nodes) {
      if (n.group && !groupIds.has(n.group)) err(dg.path, `node "${n.id}": group "${n.group}" not found`);
      const ref = n.ref;
      if (ref) {
        if (ref.kind === "wireframe" && !wfIds.has(ref.id)) err(dg.path, `node "${n.id}": wireframe ref "${ref.id}" not found`);
        if (ref.kind === "doc" && !docIds.has(ref.id)) err(dg.path, `node "${n.id}": doc ref "${ref.id}" not found`);
        if (ref.kind === "task" && !taskIds.has(ref.id)) err(dg.path, `node "${n.id}": task ref "${ref.id}" not found`);
        if (ref.kind === "path") {
          const abs = confine(projectDir, ref.id);
          if (!abs || !existsSync(abs)) err(dg.path, `node "${n.id}": path ref "${ref.id}" not found`);
        }
      }
    }
  }

  const ok = !issues.some((i) => i.level === "error");
  return {
    issues,
    ok,
    counts: {
      wireframes: ws.items.wireframes.length,
      docs: ws.items.docs.length,
      tasks: tasks.length,
      diagrams: ws.items.diagrams.length,
      phases: planFile?.phases.length ?? 0,
    },
  };
}
