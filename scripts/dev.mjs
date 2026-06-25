// Cross-platform dev launcher: runs the Vite dev server (SPA + HMR) and the
// API/WS server together, without relying on a shell (works on Windows even
// when cmd.exe is not on PATH). Vite proxies /api and /ws to the API server.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const vitePkgPath = require.resolve("vite/package.json");
const viteBinField = JSON.parse(readFileSync(vitePkgPath, "utf8")).bin;
const viteRel = typeof viteBinField === "string" ? viteBinField : viteBinField.vite;
const viteBin = path.join(path.dirname(vitePkgPath), viteRel);

const procs = [
  ["web", spawn(process.execPath, [viteBin], { stdio: "inherit", env: process.env })],
  [
    "api",
    spawn(process.execPath, ["--import", "tsx", "--watch", "src/server/standalone.ts"], {
      stdio: "inherit",
      env: process.env,
    }),
  ],
];

let exiting = false;
const killAll = () => {
  if (exiting) return;
  exiting = true;
  for (const [, p] of procs) {
    try {
      p.kill();
    } catch {
      /* ignore */
    }
  }
};

process.on("SIGINT", killAll);
process.on("SIGTERM", killAll);

for (const [name, p] of procs) {
  p.on("exit", (code) => {
    console.log(`[${name}] exited (${code ?? 0})`);
    killAll();
    process.exit(code ?? 0);
  });
  p.on("error", (e) => {
    console.error(`[${name}] ${e.message}`);
    killAll();
    process.exit(1);
  });
}
