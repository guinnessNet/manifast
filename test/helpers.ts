import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WorkspaceDTO, DocMeta, WireframeMeta } from "../src/shared/types";

/** Create an isolated temp project dir; caller cleans up via the returned dispose. */
export async function makeTempProject(): Promise<{ dir: string; dispose: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "manifast-test-"));
  return {
    dir,
    dispose: () => rm(dir, { recursive: true, force: true }),
  };
}

/** Write a file under `dir`, creating parent directories as needed. */
export async function writeFixture(dir: string, rel: string, content: string): Promise<string> {
  const abs = path.join(dir, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
  return abs;
}

/** Minimal DocMeta with sensible defaults for graph/link tests. */
export function doc(partial: Partial<DocMeta> & { id: string }): DocMeta {
  return {
    path: `docs/${partial.id}.md`,
    type: "doc",
    title: partial.id,
    status: "active",
    source: "external",
    ok: true,
    ...partial,
  };
}

export function wf(partial: Partial<WireframeMeta> & { id: string }): WireframeMeta {
  return {
    path: `.manifast/wireframes/${partial.id}.json`,
    name: partial.id,
    device: "desktop",
    ok: true,
    ...partial,
  };
}

/** Assemble a WorkspaceDTO from parts, filling empty collections. */
export function workspace(parts: Partial<WorkspaceDTO["items"]> = {}): WorkspaceDTO {
  return {
    project: { name: "test" },
    items: {
      wireframes: parts.wireframes ?? [],
      docs: parts.docs ?? [],
      tasks: parts.tasks ?? null,
      plan: parts.plan ?? null,
      diagrams: parts.diagrams ?? [],
    },
    errors: [],
  };
}
