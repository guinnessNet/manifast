import { z } from "zod";

export const ManifestSchema = z.object({
  schema: z.literal("manifast/1"),
  project: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
  generatedBy: z.string().optional(),
  updatedAt: z.string().optional(),
  // Additional document sources (project-root-relative dirs or .md files),
  // scanned recursively for .md. Defaults to .manifast/prd, .manifast/specs, docs.
  sources: z
    .object({
      docs: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;
