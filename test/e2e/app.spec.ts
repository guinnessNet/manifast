import { test, expect } from "@playwright/test";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workspace = path.join(repoRoot, "test", ".e2e-workspace");

const root = (page: import("@playwright/test").Page) => page.locator("#mf-root");

test.describe("Manifast SPA e2e (built app)", () => {
  test("boots and shows the live-reload pill", async ({ page }) => {
    await page.goto("/");
    await expect(root(page)).toBeVisible();
    // Live pill connects over the WS.
    await expect(page.getByText("Live", { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test("switches across all views", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("aside"); // sidebar — scope away from canvas thumbnails
    for (const label of ["Wireframes", "Docs", "Tasks", "Plan", "User Flow", "Tree", "Map"]) {
      await nav.getByRole("button", { name: label }).click();
      // The header title reflects the active view.
      await expect(page.locator("header").getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("theme toggle + accent persist across reload", async ({ page }) => {
    await page.goto("/");
    const before = await root(page).getAttribute("data-theme");
    await page.getByRole("button", { name: "Toggle theme" }).click();
    const toggled = before === "dark" ? "light" : "dark";
    await expect(root(page)).toHaveAttribute("data-theme", toggled);

    // Change accent to emerald.
    await page.getByRole("button", { name: "Accent color" }).click();
    await page.getByRole("button", { name: "emerald", exact: true }).click();
    await expect(root(page)).toHaveAttribute("data-accent", "emerald");

    // Both survive a full reload (localStorage-backed).
    await page.reload();
    await expect(root(page)).toHaveAttribute("data-theme", toggled);
    await expect(root(page)).toHaveAttribute("data-accent", "emerald");
  });

  test("wireframe canvas zoom + Fit controls work", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: "Wireframes" }).click();
    // Zoom/Fit are icon buttons identified by their title attribute.
    await page.getByTitle("Zoom in").click();
    await page.getByTitle("Zoom out").click();
    await page.getByTitle("Fit to screen").click();
    // Canvas still renders the wireframe nodes after transforms.
    await expect(page.locator("[data-node-type]").first()).toBeVisible();
  });

  test("export downloads a .zip of the workspace", async ({ page }) => {
    await page.goto("/");
    const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByRole("button", { name: ".zip" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });

  test("Map shows smooth (bezier) edges + node labels", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: "Map" }).click();
    // The auto Project map is radial and uses straight two-point edges. Pick an
    // authored dagre diagram so this checks the smooth routed-edge behavior.
    await page.getByRole("combobox").selectOption({ label: "Manifast 아키텍처 · architecture" });
    await expect(page.getByText("Server (Fastify)").first()).toBeVisible({ timeout: 10_000 });
    const paths = page.locator("#mf-root svg path[marker-end]");
    await expect(paths.first()).toBeVisible({ timeout: 10_000 });
    // Some edge uses a cubic-bezier command (the 1.2.14 smooth-curve behavior).
    const ds = await paths.evaluateAll((els) =>
      els.map((e) => e.getAttribute("d") ?? ""),
    );
    expect(ds.some((d) => d.includes("C"))).toBe(true);
  });

  test("live-reload reflects a new doc within ~1s", async ({ page }) => {
    await page.goto("/");
    await page.locator("aside").getByRole("button", { name: "Docs" }).click();

    const newDoc = path.join(workspace, "docs", "e2e-live.md");
    await writeFile(newDoc, "# E2E Live Doc\n\nWritten by the e2e test.\n", "utf8");
    try {
      // The workspace refetches over WS; the new doc title appears in the rail.
      await expect(page.getByText("E2E Live Doc").first()).toBeVisible({ timeout: 5_000 });
    } finally {
      await rm(newDoc, { force: true });
    }
  });
});
