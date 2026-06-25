import { cp, rm, mkdir, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FullConfig } from "@playwright/test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = Number(process.env.PW_PORT ?? 4399);

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`server at ${url} did not become ready within ${timeoutMs}ms`);
}

// Manage the server lifecycle ourselves (instead of Playwright's webServer) for
// deterministic teardown across platforms. Returns the teardown thunk Playwright
// runs after the suite.
export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const dist = path.join(repoRoot, "dist", "web", "index.html");
  try {
    await access(dist);
  } catch {
    throw new Error("dist/web is missing — run `npm run build` before the e2e suite.");
  }

  const dest = path.join(repoRoot, "test", ".e2e-workspace");
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp(path.join(repoRoot, "skill", "examples"), dest, { recursive: true });

  const child = spawn(
    process.execPath,
    [path.join(repoRoot, "dist", "cli", "index.js"), dest, "--port", String(PORT), "--no-open"],
    { cwd: repoRoot, stdio: "ignore" },
  );
  // Never let a spawn/child error crash the teardown (e.g. already exited).
  child.on("error", () => {});

  await waitForServer(`http://localhost:${PORT}/`);

  return async () => {
    // We spawned node directly (no shell), so the child IS the server process —
    // a plain kill terminates it on every platform. SIGKILL backstops a server
    // that ignores the graceful signal.
    if (child.exitCode == null && child.signalCode == null) {
      child.kill();
      await new Promise((res) => setTimeout(res, 300));
      if (child.exitCode == null && child.signalCode == null) child.kill("SIGKILL");
    }
  };
}
