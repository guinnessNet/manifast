import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { readFile, writeFile, symlink, rm } from "node:fs/promises";
import matter from "gray-matter";
import { buildApp, type BuiltApp } from "../src/server/index";
import { makeTempProject, writeFixture } from "./helpers";

let dir: string;
let dispose: () => Promise<void>;
let built: BuiltApp;

beforeEach(async () => {
  ({ dir, dispose } = await makeTempProject());
  await writeFixture(dir, ".manifast/manifast.json", JSON.stringify({ schema: "manifast/1", project: { name: "demo" } }));
  await writeFixture(
    dir,
    ".manifast/wireframes/login.json",
    JSON.stringify({
      schema: "manifast.wireframe/1",
      id: "login",
      name: "Login",
      device: "desktop",
      size: { w: 800, h: 600 },
      root: [],
    }),
  );
  await writeFixture(dir, ".manifast/tasks/tasks.json", JSON.stringify({ schema: "manifast.tasks/1", tasks: [] }));
  await writeFixture(dir, "docs/guide.md", "---\nschema: manifast.doc/1\nid: guide\ntype: doc\ntitle: Guide\n---\n\n# Guide\n\nbody\n");
  built = await buildApp({
    manifastDir: path.join(dir, ".manifast"),
    projectDir: dir,
    port: 0,
    serveStatic: false,
  });
});
afterEach(async () => {
  await built.close();
  await dispose();
});

describe("GET /api/workspace", () => {
  it("returns the workspace DTO shape", async () => {
    const res = await built.app.inject({ method: "GET", url: "/api/workspace" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.project.name).toBe("demo");
    expect(body.items.wireframes.map((w: { id: string }) => w.id)).toContain("login");
    expect(body.items.docs.some((d: { id: string }) => d.id === "guide")).toBe(true);
    expect(Array.isArray(body.errors)).toBe(true);
  });
});

describe("GET /api/file", () => {
  it("returns a parsed doc resource", async () => {
    const res = await built.app.inject({ method: "GET", url: "/api/file?path=docs/guide.md" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.kind).toBe("doc");
    expect(body.markdown).toContain("body");
  });

  it("returns a parsed wireframe resource", async () => {
    const res = await built.app.inject({ method: "GET", url: "/api/file?path=.manifast/wireframes/login.json" });
    expect(res.json().data.id).toBe("login");
  });

  it("400s when path is missing", async () => {
    const res = await built.app.inject({ method: "GET", url: "/api/file" });
    expect(res.statusCode).toBe(400);
  });

  it("returns ok:false for a missing file (server keeps serving)", async () => {
    const res = await built.app.inject({ method: "GET", url: "/api/file?path=docs/nope.md" });
    expect(res.json().ok).toBe(false);
  });
});

describe("GET /api/files & /api/raw", () => {
  it("lists files under .manifast/", async () => {
    const res = await built.app.inject({ method: "GET", url: "/api/files" });
    expect(res.json().files).toContain(".manifast/wireframes/login.json");
  });

  it("serves raw bytes with a content type", async () => {
    const res = await built.app.inject({ method: "GET", url: "/api/raw?path=docs/guide.md" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/markdown");
    expect(res.body).toContain("# Guide");
  });

  it("404s a confined-but-missing raw file", async () => {
    const res = await built.app.inject({ method: "GET", url: "/api/raw?path=docs/missing.md" });
    expect(res.statusCode).toBe(404);
  });
});

describe("path traversal (P0 security)", () => {
  const escapes = [
    "/api/file?path=../../secret.md",
    "/api/file?path=..%2f..%2fsecret.md",
    "/api/raw?path=../../secret.md",
    "/api/raw?path=..%2f..%2f..%2fetc%2fpasswd",
  ];
  for (const url of escapes) {
    it(`rejects ${url}`, async () => {
      const res = await built.app.inject({ method: "GET", url });
      // Either a 400 (raw) or an ok:false body (file) — never leaked content.
      if (res.statusCode === 200 && url.includes("/api/file")) {
        expect(res.json().ok).toBe(false);
      } else {
        expect([400, 404]).toContain(res.statusCode);
      }
    });
  }

  it("rejects an absolute path outside the root", async () => {
    const outside = path.resolve(dir, "..", "outside.md");
    const res = await built.app.inject({ method: "GET", url: `/api/raw?path=${encodeURIComponent(outside)}` });
    expect([400, 404]).toContain(res.statusCode);
  });

  it("does not follow a symlink that escapes the root", async () => {
    const secret = path.resolve(dir, "..", "mf-symlink-secret.md");
    await writeFile(secret, "TOP SECRET");
    const link = path.join(dir, "docs", "leak.md");
    try {
      await symlink(secret, link);
    } catch {
      // Platform without symlink permission (e.g. Windows w/o Developer Mode);
      // the realpath confinement still applies, just can't be exercised here.
      await rm(secret, { force: true });
      return;
    }
    const res = await built.app.inject({ method: "GET", url: "/api/raw?path=docs/leak.md" });
    expect([400, 404]).toContain(res.statusCode);
    expect(res.body).not.toContain("TOP SECRET");
    await rm(secret, { force: true });
    await rm(link, { force: true });
  });
});

describe("origin gate (CSRF / DNS-rebinding defense)", () => {
  it("rejects a POST carrying a non-local Origin", async () => {
    const res = await built.app.inject({
      method: "POST",
      url: "/api/doc/adopt",
      headers: { origin: "http://evil.example" },
      payload: { path: "docs/guide.md" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows a POST from a localhost Origin", async () => {
    const res = await built.app.inject({
      method: "POST",
      url: "/api/doc/status",
      headers: { origin: "http://localhost:5173" },
      payload: { path: "docs/guide.md", status: "draft" },
    });
    expect(res.json().ok).toBe(true);
  });
});

describe("POST /api/doc/* (the only writer)", () => {
  it("adopt stamps a uid and is reflected on disk", async () => {
    const res = await built.app.inject({ method: "POST", url: "/api/doc/adopt", payload: { path: "docs/guide.md" } });
    expect(res.json().ok).toBe(true);
    const uid = res.json().uid;
    const fm = matter(await readFile(path.join(dir, "docs/guide.md"), "utf8")).data;
    expect(fm.uid).toBe(uid);
  });

  it("status sets lifecycle status", async () => {
    const res = await built.app.inject({ method: "POST", url: "/api/doc/status", payload: { path: "docs/guide.md", status: "active" } });
    expect(res.json().ok).toBe(true);
    const fm = matter(await readFile(path.join(dir, "docs/guide.md"), "utf8")).data;
    expect(fm.status).toBe("active");
  });

  it("review stamps lastReviewed", async () => {
    const res = await built.app.inject({ method: "POST", url: "/api/doc/review", payload: { path: "docs/guide.md", reviewBy: 14 } });
    expect(res.json().ok).toBe(true);
    const raw = await readFile(path.join(dir, "docs/guide.md"), "utf8");
    expect(matter(raw).data.reviewBy).toBe(14);
    expect(raw).toMatch(/^lastReviewed: \d{4}-\d{2}-\d{2}$/m);
  });

  it("400s adopt without a path", async () => {
    const res = await built.app.inject({ method: "POST", url: "/api/doc/adopt", payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("refuses to write outside the project root", async () => {
    const res = await built.app.inject({ method: "POST", url: "/api/doc/adopt", payload: { path: "../escape.md" } });
    expect(res.json().ok).toBe(false);
  });
});
