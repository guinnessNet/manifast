import { z } from "zod";

// Generic node/edge diagram. Authored by an agent (architecture, doc map, flow)
// or auto-derived by the app. The app lays it out (dagre) and renders it.

export const DiagramRefSchema = z.object({
  kind: z.enum(["wireframe", "doc", "task", "path"]),
  id: z.string(),
});
export type DiagramRef = z.infer<typeof DiagramRefSchema>;

export const DiagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  group: z.string().optional(), // group/cluster id
  kind: z.string().optional(), // e.g. module|service|layer|db|external|doc|wireframe|task
  description: z.string().optional(),
  ref: DiagramRefSchema.optional(), // clickable link to a manifast item
});
export type DiagramNode = z.infer<typeof DiagramNodeSchema>;

export const DiagramEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  kind: z.string().optional(), // depends|calls|imports|links|...
});
export type DiagramEdge = z.infer<typeof DiagramEdgeSchema>;

export const DiagramGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type DiagramGroup = z.infer<typeof DiagramGroupSchema>;

export const DiagramFileSchema = z.object({
  schema: z.literal("manifast.diagram/1"),
  id: z.string(),
  title: z.string(),
  kind: z.string().optional().default("diagram"), // architecture|docmap|flow|...
  direction: z.enum(["TB", "LR", "BT", "RL"]).optional(), // layout direction
  generatedBy: z.string().optional(),
  generatedAt: z.string().optional(),
  groups: z.array(DiagramGroupSchema).optional(),
  nodes: z.array(DiagramNodeSchema),
  edges: z.array(DiagramEdgeSchema),
});
export type DiagramFile = z.infer<typeof DiagramFileSchema>;
