import { z } from "zod";

export const DocStatusSchema = z.enum(["draft", "active", "done", "deprecated", "archived"]);
export type DocStatus = z.infer<typeof DocStatusSchema>;

// First-class document types (v4): planning (prd/spec/doc), decision records
// (adr), architecture (arc42/C4), the Diátaxis four, execution records, and
// reusable prompts. Supported, not mandated — the skill picks the right set per
// project (see DESIGN 부록 D.6).
export const DOC_TYPES = [
  "prd",
  "spec",
  "doc",
  "adr",
  "tutorial",
  "howto",
  "reference",
  "explanation",
  "architecture",
  "plan",
  "results",
  "handoff",
  "prompt",
] as const;
export const DocTypeSchema = z.enum(DOC_TYPES);
export type DocType = z.infer<typeof DocTypeSchema>;

// PRD / spec / doc frontmatter. Failures here are non-fatal warnings: the
// markdown body still renders, the doc header shows the warning.
export const DocFrontmatterSchema = z.object({
  schema: z.literal("manifast.doc/1"),
  // uid: random, app-managed stable identity (survives folder moves/renames).
  uid: z.string().optional(),
  id: z.string(),
  type: DocTypeSchema,
  title: z.string(),
  status: DocStatusSchema.optional().default("draft"),
  wireframe: z.string().optional(),
  tasks: z.array(z.string()).optional(),
  // doc↔doc relationships (ids/uids of related docs/specs). Used to wire docs
  // into the graph so genuinely-related docs aren't flagged as orphans, and to
  // draw doc↔doc edges on the project map.
  related: z.array(z.string()).optional(),
  // governance (v4) — owner + freshness; `sources` feeds staleness/drift.
  owner: z.string().optional(),
  lastReviewed: z.string().optional(),
  reviewBy: z.number().optional(), // review TTL in days
  sources: z.array(z.string()).optional(), // code paths this doc describes
  critical: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deprecatedAt: z.string().optional(),
  archivedAt: z.string().optional(),
  deprecatedBy: z.string().optional(), // successor doc id/uid
});

export type DocFrontmatter = z.infer<typeof DocFrontmatterSchema>;
