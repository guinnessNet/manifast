import { z } from "zod";

export const TaskStatusSchema = z.enum(["todo", "in_progress", "done", "blocked"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(["low", "med", "high"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema.optional().default("med"),
  specId: z.string().optional(),
  wireframeId: z.string().optional(),
  deps: z.array(z.string()).optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TasksFileSchema = z.object({
  schema: z.literal("manifast.tasks/1"),
  tasks: z.array(TaskSchema),
});
export type TasksFile = z.infer<typeof TasksFileSchema>;

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "blocked"];
