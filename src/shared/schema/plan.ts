import { z } from "zod";

export const PhaseStatusSchema = z.enum(["planned", "active", "done"]);
export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

export const PhaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string().optional(),
  status: PhaseStatusSchema.optional().default("planned"),
  taskIds: z.array(z.string()).optional(),
});
export type Phase = z.infer<typeof PhaseSchema>;

export const PlanFileSchema = z.object({
  schema: z.literal("manifast.plan/1"),
  phases: z.array(PhaseSchema),
});
export type PlanFile = z.infer<typeof PlanFileSchema>;
