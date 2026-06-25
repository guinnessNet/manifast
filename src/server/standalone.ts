// Dev-only entry: starts the API + WS server (no static SPA — Vite serves the
// SPA on :5173 and proxies /api and /ws here). Run via `npm run dev`.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./index";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");

const projectDir = process.env.MANIFAST_DIR
  ? path.resolve(process.env.MANIFAST_DIR)
  : path.join(repoRoot, "skill", "examples");
const manifastDir = path.join(projectDir, ".manifast");

const server = await createServer({
  manifastDir,
  projectDir,
  port: Number(process.env.PORT ?? 4317),
  serveStatic: false,
});

console.log(`[manifast:dev] API + WS on ${server.url}`);
console.log(`[manifast:dev] workspace: ${manifastDir}`);
console.log(`[manifast:dev] open the Vite dev server (usually http://localhost:5173)`);
