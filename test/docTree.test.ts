import { describe, it, expect } from "vitest";
import { buildDocTree, allFolderPaths, folderLabel, type DocTreeFolder } from "../src/web/lib/docTree";
import { doc } from "./helpers";

/** Find a folder node by its full path (depth-first). */
function find(root: DocTreeFolder, path: string): DocTreeFolder | undefined {
  if (root.path === path) return root;
  for (const f of root.folders) {
    const hit = find(f, path);
    if (hit) return hit;
  }
  return undefined;
}

describe("buildDocTree", () => {
  it("nests docs into a folder→folder→doc hierarchy", () => {
    const tree = buildDocTree([
      doc({ id: "a", path: "docs/specs/claim/CLAIM_BUILD_V1.md", title: "Claim build" }),
      doc({ id: "b", path: "docs/specs/claim/CLAIM_AUDIT_V1.md", title: "Claim audit" }),
      doc({ id: "c", path: "docs/specs/ENVELOPE_V1.md", title: "Envelope" }),
    ]);
    const docsFolder = find(tree, "docs")!;
    expect(docsFolder.name).toBe("docs");
    const specs = find(tree, "docs/specs")!;
    const claim = find(tree, "docs/specs/claim")!;
    expect(specs.folders.map((f) => f.path)).toContain("docs/specs/claim");
    expect(specs.docs.map((d) => d.id)).toEqual(["c"]); // ENVELOPE sits directly in specs
    expect(claim.docs.map((d) => d.id).sort()).toEqual(["a", "b"]);
  });

  it("rolls up a recursive doc count at every level", () => {
    const tree = buildDocTree([
      doc({ id: "a", path: "docs/specs/claim/x.md" }),
      doc({ id: "b", path: "docs/specs/claim/y.md" }),
      doc({ id: "c", path: "docs/specs/z.md" }),
      doc({ id: "d", path: "docs/top.md" }),
    ]);
    expect(find(tree, "docs/specs/claim")!.count).toBe(2);
    expect(find(tree, "docs/specs")!.count).toBe(3); // claim(2) + z
    expect(find(tree, "docs")!.count).toBe(4); // specs(3) + top
  });

  it("places root-level files in the synthetic root's docs", () => {
    const tree = buildDocTree([
      doc({ id: "readme", path: "README.md", title: "Readme" }),
      doc({ id: "claude", path: "CLAUDE.md", title: "Claude" }),
      doc({ id: "nested", path: "docs/x.md" }),
    ]);
    expect(tree.docs.map((d) => d.id).sort()).toEqual(["claude", "readme"]);
    expect(tree.folders.map((f) => f.path)).toEqual(["docs"]);
  });

  it("sorts folders by name and docs by title", () => {
    const tree = buildDocTree([
      doc({ id: "z", path: "docs/zeta/z.md", title: "Zeta" }),
      doc({ id: "a", path: "docs/alpha/a.md", title: "Alpha" }),
      doc({ id: "m2", path: "docs/m2.md", title: "Mango" }),
      doc({ id: "m1", path: "docs/m1.md", title: "Apple" }),
    ]);
    const docsFolder = find(tree, "docs")!;
    expect(docsFolder.folders.map((f) => f.name)).toEqual(["alpha", "zeta"]);
    expect(docsFolder.docs.map((d) => d.title)).toEqual(["Apple", "Mango"]);
  });

  it("normalizes backslash path separators (Windows authors)", () => {
    const tree = buildDocTree([doc({ id: "a", path: "docs\\specs\\a.md" })]);
    expect(find(tree, "docs/specs")).toBeDefined();
  });

  it("collects every folder path for collapse-all", () => {
    const tree = buildDocTree([
      doc({ id: "a", path: "docs/specs/claim/x.md" }),
      doc({ id: "b", path: ".manifast/prd/p.md" }),
    ]);
    expect(allFolderPaths(tree).sort()).toEqual([
      ".manifast",
      ".manifast/prd",
      "docs",
      "docs/specs",
      "docs/specs/claim",
    ]);
  });

  it("labels manifast-authored folders but uses the segment name elsewhere", () => {
    const tree = buildDocTree([
      doc({ id: "a", path: ".manifast/prd/p.md" }),
      doc({ id: "b", path: ".manifast/specs/s.md" }),
      doc({ id: "c", path: "docs/specs/claim/x.md" }),
    ]);
    expect(folderLabel(find(tree, ".manifast/prd")!)).toBe("PRD");
    expect(folderLabel(find(tree, ".manifast/specs")!)).toBe("Specs");
    expect(folderLabel(find(tree, "docs/specs/claim")!)).toBe("claim");
  });
});
