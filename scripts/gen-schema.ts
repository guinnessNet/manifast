import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  WireframeSchema,
  TasksFileSchema,
  PlanFileSchema,
  DocFrontmatterSchema,
  DiagramFileSchema,
  ManifestSchema,
} from "../src/shared/schema/index";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "skill", "schema");

const targets = [
  { file: "wireframe.schema.json", name: "Wireframe", schema: WireframeSchema },
  { file: "tasks.schema.json", name: "Tasks", schema: TasksFileSchema },
  { file: "plan.schema.json", name: "Plan", schema: PlanFileSchema },
  { file: "frontmatter.schema.json", name: "DocFrontmatter", schema: DocFrontmatterSchema },
  { file: "diagram.schema.json", name: "Diagram", schema: DiagramFileSchema },
  { file: "manifast.schema.json", name: "Manifest", schema: ManifestSchema },
] as const;

await mkdir(outDir, { recursive: true });

for (const t of targets) {
  const json = zodToJsonSchema(t.schema, { name: t.name });
  await writeFile(path.join(outDir, t.file), JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`Wrote skill/schema/${t.file}`);
}
