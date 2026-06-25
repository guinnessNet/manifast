import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { WebSocket } from "ws";
import { createServer, type RunningServer } from "../src/server/index";
import { makeTempProject, writeFixture } from "./helpers";

let dir: string;
let dispose: () => Promise<void>;
let server: RunningServer | null;

beforeEach(async () => {
  ({ dir, dispose } = await makeTempProject());
  await writeFixture(dir, ".manifast/manifast.json", JSON.stringify({ schema: "manifast/1", project: { name: "p" } }));
  server = null;
});
afterEach(async () => {
  if (server) await server.close().catch(() => {});
  await dispose();
});

describe("graceful shutdown (1.2.12 regression guard)", () => {
  it("server.close() resolves within ~1s even with an open /ws client", async () => {
    server = await createServer({
      manifastDir: path.join(dir, ".manifast"),
      projectDir: dir,
      port: 4391, // a concrete port (findFreePort bumps if busy); url must match
      serveStatic: false,
    });

    // Open a live-reload socket and wait until it's actually connected.
    const ws = new WebSocket(`${server.url.replace("http", "ws")}/ws`);
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", reject);
    });

    const start = Date.now();
    await server.close();
    server = null;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1500); // force-closes the socket instead of hanging
    try {
      ws.terminate();
    } catch {
      /* already closed */
    }
  });
});
