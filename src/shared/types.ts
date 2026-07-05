import type { Screen } from "./schema/wireframe";
import type { Task } from "./schema/tasks";
import type { Phase } from "./schema/plan";
import type { DiagramFile } from "./schema/diagram";
import type { DocType } from "./schema/frontmatter";

/** Resource kind, also used by the watcher / WS messages. */
export type Kind = "wireframe" | "doc" | "tasks" | "plan" | "diagram" | "manifest" | "other";

export interface Validity {
  ok: boolean;
  error?: string;
}

// --- /api/workspace --------------------------------------------------------

export interface WireframeMeta extends Validity {
  path: string; // relative to .manifast/
  id: string;
  name: string;
  device: string;
}

/** App-computed freshness signal (AI-free: file mtime vs review baseline). */
export interface DocFreshness {
  stale: boolean;
  score: number; // 0..100 (100 = fresh)
  reason?: string; // why it's stale, if it is
}

export interface DocMeta extends Validity {
  path: string; // relative to the PROJECT ROOT (docs may live outside .manifast/)
  uid?: string; // app-managed stable id (survives moves); absent until adopted
  id: string;
  type: DocType;
  title: string;
  status: string; // draft|active|done|deprecated|archived (or inferred)
  source: "manifast" | "external";
  wireframe?: string;
  tasks?: string[];
  related?: string[]; // ids/uids of related docs (doc↔doc links)
  /** Markdown-body links to other local .md files (project-root-relative paths,
      extracted server-side) — how real docs actually cross-reference. */
  links?: string[];
  // governance (v4)
  owner?: string;
  lastReviewed?: string;
  reviewBy?: number; // review TTL in days
  sources?: string[]; // code paths this doc describes
  critical?: boolean;
  freshness?: DocFreshness; // derived (not from the file)
  createdAt?: string;
  updatedAt?: string;
  deprecatedAt?: string;
  archivedAt?: string;
  deprecatedBy?: string;
  /** Non-fatal frontmatter problem; body still renders. */
  warning?: string;
}

export interface TasksData extends Validity {
  path: string;
  tasks: Task[];
}

export interface PlanData extends Validity {
  path: string;
  phases: Phase[];
}

export interface DiagramMeta extends Validity {
  path: string;
  id: string;
  title: string;
  kind: string;
  nodeCount: number;
  edgeCount: number;
}

export interface WorkspaceDTO {
  project: { name: string; description?: string };
  items: {
    wireframes: WireframeMeta[];
    docs: DocMeta[]; // unified PRD + specs + external docs (type discriminates)
    tasks: TasksData | null;
    plan: PlanData | null;
    diagrams: DiagramMeta[];
  };
  errors: { path: string; error: string }[];
}

// --- /api/file?path= -------------------------------------------------------

export interface WireframeFileResp extends Validity {
  kind: "wireframe";
  path: string;
  data: Screen | null;
}
export interface TasksFileResp extends Validity {
  kind: "tasks";
  path: string;
  data: { schema: string; tasks: Task[] } | null;
}
export interface PlanFileResp extends Validity {
  kind: "plan";
  path: string;
  data: { schema: string; phases: Phase[] } | null;
}
export interface DocFileResp extends Validity {
  kind: "doc";
  path: string;
  frontmatter: Record<string, unknown> | null;
  markdown: string;
  warning?: string;
}
export interface DiagramFileResp extends Validity {
  kind: "diagram";
  path: string;
  data: DiagramFile | null;
}
export type FileResponse =
  | WireframeFileResp
  | TasksFileResp
  | PlanFileResp
  | DocFileResp
  | DiagramFileResp;

// --- WS /ws ----------------------------------------------------------------

export interface WsMessage {
  type: "change" | "add" | "unlink";
  path: string; // relative to .manifast/
  kind: Kind;
  ok: boolean;
  error?: string;
}
