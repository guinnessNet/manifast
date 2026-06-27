import { readWorkspace } from "../server/workspace";

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

  // 1. Schema / parse failures (invalid JSON, frontmatter that fails the schema).
  for (const e of ws.errors) err(e.path, e.error);
  for (const w of ws.items.wireframes) if (!w.ok && w.error) err(w.path, w.error);
  for (const d of ws.items.diagrams) if (!d.ok && d.error) err(d.path, d.error);
  for (const d of ws.items.docs) {
    if (!d.ok && d.error) err(d.path, d.error);
    // A `manifast.doc/1` doc whose frontmatter doesn't fit the schema.
    if (d.warning) warn(d.path, `frontmatter: ${d.warning}`);
  }

  // 2. Duplicate ids (authored JSON ids must be unique; doc ids may be inferred
  //    from filenames, so a clash there is a warning rather than an error).
  const tasksFile = ws.items.tasks;
  const planFile = ws.items.plan;
  const tasks = tasksFile?.tasks ?? [];
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
