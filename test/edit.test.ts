import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { adoptDoc, setDocStatus, setDocReview } from "../src/server/edit";
import { makeTempProject, writeFixture } from "./helpers";

let dir: string;
let dispose: () => Promise<void>;
const read = (rel: string) => readFile(path.join(dir, rel), "utf8");

beforeEach(async () => {
  ({ dir, dispose } = await makeTempProject());
});
afterEach(() => dispose());

const DOC = `---
schema: manifast.doc/1
id: d1
type: doc
title: Doc One
---

# Doc One

Body paragraph **untouched**.

- a list item
`;

describe("adoptDoc", () => {
  it("stamps a uid into frontmatter and leaves the body byte-identical", async () => {
    await writeFixture(dir, "docs/d.md", DOC);
    const res = await adoptDoc(dir, "docs/d.md");
    expect(res.ok).toBe(true);
    expect(res.uid).toBeTruthy();

    const after = await read("docs/d.md");
    expect(matter(after).data.uid).toBe(res.uid);
    // Body (everything after frontmatter) is preserved exactly.
    expect(matter(after).content).toBe(matter(DOC).content);
    expect(after).toContain("Body paragraph **untouched**.");
  });

  it("is idempotent — re-adopting keeps the same uid and does not rewrite the body", async () => {
    await writeFixture(dir, "docs/d.md", DOC);
    const first = await adoptDoc(dir, "docs/d.md");
    const afterFirst = await read("docs/d.md");
    const second = await adoptDoc(dir, "docs/d.md");
    const afterSecond = await read("docs/d.md");
    expect(second.uid).toBe(first.uid);
    expect(afterSecond).toBe(afterFirst);
  });

  it("creates a frontmatter block when the doc has none, keeping the original body", async () => {
    await writeFixture(dir, "docs/plain.md", "# Plain\n\njust text\n");
    const res = await adoptDoc(dir, "docs/plain.md");
    expect(res.ok).toBe(true);
    const after = await read("docs/plain.md");
    expect(matter(after).data.uid).toBe(res.uid);
    expect(matter(after).content.trim()).toBe("# Plain\n\njust text");
  });

  it("preserves CRLF line endings", async () => {
    const crlf = DOC.replace(/\n/g, "\r\n");
    await writeFixture(dir, "docs/crlf.md", crlf);
    await adoptDoc(dir, "docs/crlf.md");
    const after = await read("docs/crlf.md");
    // The original CRLF body lines survive (writer must not normalize EOL).
    expect(after).toContain("Body paragraph **untouched**.\r\n");
  });

  it("rejects a path that escapes the project root", async () => {
    const res = await adoptDoc(dir, "../escape.md");
    expect(res.ok).toBe(false);
  });

  it("rejects a non-markdown path", async () => {
    const res = await adoptDoc(dir, "docs/data.json");
    expect(res.ok).toBe(false);
  });
});

describe("setDocStatus", () => {
  it("writes status + updatedAt only, never the body", async () => {
    await writeFixture(dir, "docs/d.md", DOC);
    const res = await setDocStatus(dir, "docs/d.md", "active");
    expect(res.ok).toBe(true);
    const after = await read("docs/d.md");
    expect(matter(after).data.status).toBe("active");
    // Dates are written as bare YAML scalars (the app normalizes them to strings
    // on read); assert on the serialized text rather than the re-parsed Date.
    expect(after).toMatch(/^updatedAt: \d{4}-\d{2}-\d{2}$/m);
    expect(matter(after).content).toBe(matter(DOC).content);
  });

  it("stamps deprecatedAt + successor when deprecating", async () => {
    await writeFixture(dir, "docs/d.md", DOC);
    await setDocStatus(dir, "docs/d.md", "deprecated", "docs/new.md");
    const after = await read("docs/d.md");
    const fm = matter(after).data;
    expect(fm.status).toBe("deprecated");
    expect(after).toMatch(/^deprecatedAt: \d{4}-\d{2}-\d{2}$/m);
    expect(fm.deprecatedBy).toBe("docs/new.md");
  });

  it("rejects an unknown status", async () => {
    await writeFixture(dir, "docs/d.md", DOC);
    const res = await setDocStatus(dir, "docs/d.md", "frozen");
    expect(res.ok).toBe(false);
  });

  it("updating status twice only changes frontmatter, body stays intact", async () => {
    await writeFixture(dir, "docs/d.md", DOC);
    await setDocStatus(dir, "docs/d.md", "active");
    await setDocStatus(dir, "docs/d.md", "done");
    const after = await read("docs/d.md");
    expect(matter(after).data.status).toBe("done");
    expect(matter(after).content).toBe(matter(DOC).content);
    // No duplicate status keys were appended.
    expect((after.match(/^status:/gm) ?? []).length).toBe(1);
  });
});

describe("setDocReview", () => {
  it("stamps lastReviewed (today) and optional owner/reviewBy without touching the body", async () => {
    await writeFixture(dir, "docs/d.md", DOC);
    const res = await setDocReview(dir, "docs/d.md", { owner: "kjh", reviewBy: 30 });
    expect(res.ok).toBe(true);
    const after = await read("docs/d.md");
    const fm = matter(after).data;
    expect(after).toMatch(/^lastReviewed: \d{4}-\d{2}-\d{2}$/m);
    expect(fm.owner).toBe("kjh");
    expect(fm.reviewBy).toBe(30);
    expect(matter(after).content).toBe(matter(DOC).content);
  });

  it("accepts an explicit valid lastReviewed date", async () => {
    await writeFixture(dir, "docs/d.md", DOC);
    await setDocReview(dir, "docs/d.md", { lastReviewed: "2025-12-01" });
    expect(await read("docs/d.md")).toMatch(/^lastReviewed: 2025-12-01$/m);
  });
});
