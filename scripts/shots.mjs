// Capture README screenshots of the 5 views against skill/examples (dark theme).
// Usage: npm run build && node scripts/shots.mjs
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4420;
const outDir = path.join(root, "docs", "screenshots");

async function waitReady(url, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server not ready");
}

await mkdir(outDir, { recursive: true });
const srv = spawn(process.execPath, [path.join(root, "dist/cli/index.js"), path.join(root, "skill/examples"), "--port", String(PORT), "--no-open"], { stdio: "ignore" });
srv.on("error", () => {});
try {
  await waitReady(`http://localhost:${PORT}/`);
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  // Force dark theme + indigo accent before the app mounts.
  await ctx.addInitScript(() => {
    localStorage.setItem("mf-theme", "dark");
    localStorage.setItem("mf-accent", "indigo");
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  await page.locator("#mf-root").waitFor();

  const views = ["Wireframes", "Docs", "Tasks", "Plan", "Map"];
  for (const label of views) {
    await page.locator("aside").getByRole("button", { name: label }).click();
    await page.waitForTimeout(700); // let layout/animation settle
    const file = path.join(outDir, `${label.toLowerCase()}.png`);
    await page.screenshot({ path: file });
    console.log("wrote", path.relative(root, file));
  }
  await browser.close();
} finally {
  srv.kill();
}
