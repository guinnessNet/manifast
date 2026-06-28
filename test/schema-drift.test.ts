import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  WireframeSchema,
  TasksFileSchema,
  PlanFileSchema,
  DocFrontmatterSchema,
  DiagramFileSchema,
  ManifestSchema,
} from "../src/shared/schema/index";

// Mirror scripts/gen-schema.ts so the agent-facing contract (skill/schema/*.json)
// can never silently drift from the zod source of truth. If this fails, run
// `npm run gen:schema` and commit the result.
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "skill", "schema");

const targets = [
  { file: "wireframe.schema.json", name: "Wireframe", schema: WireframeSchema },
  { file: "tasks.schema.json", name: "Tasks", schema: TasksFileSchema },
  { file: "plan.schema.json", name: "Plan", schema: PlanFileSchema },
  { file: "frontmatter.schema.json", name: "DocFrontmatter", schema: DocFrontmatterSchema },
  { file: "diagram.schema.json", name: "Diagram", schema: DiagramFileSchema },
  { file: "manifast.schema.json", name: "Manifest", schema: ManifestSchema },
] as const;

describe("schema-drift guard (skill/schema in sync with zod)", () => {
  for (const t of targets) {
    it(`${t.file} matches the generated output`, async () => {
      const expected = JSON.stringify(zodToJsonSchema(t.schema, { name: t.name }), null, 2) + "\n";
      const committed = await readFile(path.join(outDir, t.file), "utf8");
      // Compare on LF-normalized content so a Windows checkout doesn't false-fail.
      expect(committed.replace(/\r\n/g, "\n")).toBe(expected);
    });
  }
});
