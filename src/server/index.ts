import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { readFile as fsReadFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {
  readWorkspace,
  readFileResource,
  listAllFiles,
  classifyPath,
  validatePath,
  resolveWatchRoots,
} from "./workspace";
import { createWatcher } from "./watcher";
import { adoptDoc, setDocStatus, setDocReview } from "./edit";
import { confine } from "./safePath";
import type { WsMessage } from "../shared/types";

export interface ServerOptions {
  manifastDir: string;
  projectDir: string;
  port: number;
  host?: string;
  serveStatic: boolean;
  webDir?: string;
}

export interface RunningServer {
  port: number;
  url: string;
  close: () => Promise<void>;
}

// Minimal structural type for a ws socket (avoids depending on @types/ws).
interface WsClient {
  send(data: string): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  terminate?(): void;
  close?(): void;
}

function probePort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
}

async function findFreePort(start: number, host: string, tries = 20): Promise<number> {
  for (let p = start; p < start + tries; p++) {
    if (await probePort(p, host)) return p;
  }
  return start;
}

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function isLocalHostname(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

/**
 * Reject requests addressed to a non-local Host (DNS-rebinding defense: a
 * rebound attacker domain becomes "same-origin" to localhost and could read GET
 * responses). Applied to every request — GET included. A missing Host header
 * (non-HTTP/1.1 clients) is allowed; browsers always send one.
 */
function isLocalHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return true;
  return isLocalHostname(hostHeader.replace(/:\d+$/, ""));
}

/**
 * Reject browser requests from a non-local Origin (CSRF defense for this
 * localhost-only tool). Non-browser clients (curl, the SSR check) send no Origin
 * and are allowed.
 */
function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  try {
    return isLocalHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export interface BuiltApp {
  app: ReturnType<typeof Fastify>;
  /** Tear down sockets + watcher + the Fastify app (idempotent-safe). */
  close: () => Promise<void>;
}

/**
 * Build the fully-wired Fastify app (REST + WS + watcher + optional static SPA)
 * WITHOUT binding a socket, so tests can drive it via `app.inject()`. The
 * listening wrapper lives in `createServer`.
 */
export async function buildApp(opts: ServerOptions): Promise<BuiltApp> {
  const app = Fastify({ logger: false, forceCloseConnections: true });
  await app.register(fastifyWebsocket);

  const sockets = new Set<WsClient>();

  app.addHook("onRequest", async (req, reply) => {
    // DNS-rebinding defense — only serve requests addressed to a local Host.
    if (!isLocalHost(req.headers.host)) {
      return reply.code(403).send({ ok: false, error: "Rejected: non-local host" });
    }
    // CSRF defense — reject state-changing requests from a non-local Origin.
    if (req.method === "POST" && !isLocalOrigin(req.headers.origin)) {
      return reply.code(403).send({ ok: false, error: "Rejected: cross-origin request" });
    }
  });

  // --- REST ---------------------------------------------------------------
  app.get("/api/workspace", async () => readWorkspace(opts.manifastDir, opts.projectDir));

  app.get("/api/file", async (req, reply) => {
    const q = req.query as { path?: string };
    if (!q.path) {
      reply.code(400);
      return { ok: false, error: "The path query parameter is required" };
    }
    return readFileResource(opts.projectDir, q.path);
  });

  app.get("/api/files", async () => ({ files: await listAllFiles(opts.manifastDir, opts.projectDir) }));

  // Doc write-back (uid + lifecycle metadata only — never the body).
  app.post("/api/doc/adopt", async (req, reply) => {
    const b = (req.body ?? {}) as { path?: string };
    if (!b.path) {
      reply.code(400);
      return { ok: false, error: "path is required" };
    }
    return adoptDoc(opts.projectDir, b.path);
  });

  app.post("/api/doc/status", async (req, reply) => {
    const b = (req.body ?? {}) as { path?: string; status?: string; deprecatedBy?: string };
    if (!b.path || !b.status) {
      reply.code(400);
      return { ok: false, error: "path and status are required" };
    }
    return setDocStatus(opts.projectDir, b.path, b.status, b.deprecatedBy);
  });

  app.post("/api/doc/review", async (req, reply) => {
    const b = (req.body ?? {}) as {
      path?: string;
      owner?: string;
      lastReviewed?: string;
      reviewBy?: number;
    };
    if (!b.path) {
      reply.code(400);
      return { ok: false, error: "path is required" };
    }
    return setDocReview(opts.projectDir, b.path, {
      owner: b.owner,
      lastReviewed: b.lastReviewed,
      reviewBy: b.reviewBy,
    });
  });

  // Raw file bytes (for JSON/MD/ZIP export — original content, no parsing).
  app.get("/api/raw", async (req, reply) => {
    const q = req.query as { path?: string };
    if (!q.path) {
      reply.code(400);
      return reply.send("path required");
    }
    const abs = confine(opts.projectDir, q.path);
    if (!abs) {
      reply.code(400);
      return reply.send("invalid path");
    }
    try {
      const raw = await fsReadFile(abs, "utf8");
      const ext = path.extname(abs).toLowerCase();
      reply.header("content-type", CONTENT_TYPES[ext] ?? "text/plain; charset=utf-8");
      return reply.send(raw);
    } catch {
      reply.code(404);
      return reply.send("not found");
    }
  });

  // --- WebSocket ----------------------------------------------------------
  await app.register(async (f) => {
    f.get("/ws", { websocket: true }, (socket, req) => {
      // A malicious page could open this socket and observe file-change paths;
      // gate it to local Origins (non-browser clients send none).
      if (!isLocalOrigin(req.headers.origin)) {
        (socket.terminate ?? socket.close)?.call(socket);
        return;
      }
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => sockets.delete(socket));
    });
  });

  function broadcast(msg: WsMessage) {
    const data = JSON.stringify(msg);
    for (const s of sockets) {
      try {
        s.send(data);
      } catch {
        sockets.delete(s);
      }
    }
  }

  // --- Watcher → WS broadcast --------------------------------------------
  const watchRoots = await resolveWatchRoots(opts.manifastDir, opts.projectDir);
  const watcher = createWatcher(watchRoots.dirs, watchRoots.files, opts.projectDir, async (events) => {
    for (const ev of events) {
      const kind = classifyPath(ev.relPath);
      let ok = true;
      let error: string | undefined;
      if (ev.type !== "unlink") {
        const v = await validatePath(opts.projectDir, ev.relPath);
        ok = v.ok;
        error = v.error;
      }
      broadcast({ type: ev.type, path: ev.relPath, kind, ok, error });
    }
  });

  // --- Static SPA (production) -------------------------------------------
  if (opts.serveStatic && opts.webDir) {
    await app.register(fastifyStatic, { root: opts.webDir, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === "GET" && !req.url.startsWith("/api") && !req.url.startsWith("/ws")) {
        return reply.type("text/html").sendFile("index.html");
      }
      reply.code(404).send({ ok: false, error: "not found" });
    });
  }

  const close = async () => {
    // Browsers keep the /ws live-reload socket open; without forcing them
    // shut, app.close() waits forever and Ctrl+C appears to hang.
    for (const s of sockets) {
      try {
        (s.terminate ?? s.close)?.call(s);
      } catch {
        /* ignore */
      }
    }
    sockets.clear();
    await watcher.close();
    await app.close();
  };

  return { app, close };
}

export async function createServer(opts: ServerOptions): Promise<RunningServer> {
  const { app, close } = await buildApp(opts);

  // --- Listen -------------------------------------------------------------
  const host = opts.host ?? "127.0.0.1";
  const port = await findFreePort(opts.port, host);
  await app.listen({ port, host });

  return {
    port,
    url: `http://localhost:${port}`,
    close,
  };
}
