import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { readWorkspace } from "../src/server/workspace";
import { makeTempProject, writeFixture } from "./helpers";

let dir: string;
let dispose: () => Promise<void>;
const mf = () => path.join(dir, ".manifast");

beforeEach(async () => {
  ({ dir, dispose } = await makeTempProject());
});
afterEach(() => dispose());

describe("perf smoke — large workspace", () => {
  it("parses hundreds of docs (incl. a large one) and reuses the mtime cache", async () => {
    const N = 300;
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        writeFixture(
          dir,
          `docs/d${i}.md`,
          `---\nschema: manifast.doc/1\nid: d${i}\ntype: doc\ntitle: Doc ${i}\nrelated: [d${(i + 1) % N}]\n---\n\n# Doc ${i}\n\nbody ${i}\n`,
        ),
      ),
    );
    // One genuinely large doc: H1 only in the head, ~200KB of trailing filler.
    await writeFixture(dir, "docs/huge.md", "# Huge Doc\n\n" + "lorem ipsum ".repeat(20000));

    const t0 = Date.now();
    const ws1 = await readWorkspace(mf(), dir);
    const cold = Date.now() - t0;

    expect(ws1.items.docs.length).toBe(N + 1);
    expect(ws1.items.docs.find((d) => d.path === "docs/huge.md")?.title).toBe("Huge Doc");
    expect(ws1.errors).toHaveLength(0);

    // Second read hits the mtime/size cache and must not be slower than cold.
    const t1 = Date.now();
    const ws2 = await readWorkspace(mf(), dir);
    const warm = Date.now() - t1;
    expect(ws2.items.docs.length).toBe(N + 1);

    // Generous bound — catches pathological regressions without timing flake.
    expect(cold).toBeLessThan(8000);
    expect(warm).toBeLessThanOrEqual(cold + 500);
  });
});
