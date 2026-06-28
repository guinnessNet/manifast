import { test, expect } from "@playwright/test";

// Pragmatic a11y guards: the interactive chrome must be reachable + operable by
// keyboard and expose accessible names (not a full axe audit, but a regression
// net for the controls users actually drive).
test.describe("accessibility", () => {
  test("key controls expose accessible names", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Toggle theme" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accent color" })).toBeVisible();
    await expect(page.getByRole("button", { name: ".zip" })).toBeVisible();
    // All 5 view nav items are buttons with discernible text.
    const nav = page.locator("aside");
    for (const label of ["Wireframes", "Docs", "Tasks", "Plan", "Map"]) {
      await expect(nav.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("the theme toggle is keyboard-operable", async ({ page }) => {
    await page.goto("/");
    const root = page.locator("#mf-root");
    const before = await root.getAttribute("data-theme");
    const toggle = page.getByRole("button", { name: "Toggle theme" });
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(root).not.toHaveAttribute("data-theme", before!);
  });

  test("Tab moves focus into interactive controls", async ({ page }) => {
    await page.goto("/");
    // Walk a few tab stops; focus should land on a real interactive element.
    let landedOnControl = false;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      const tag = await page.evaluate(() => document.activeElement?.tagName ?? "");
      if (["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(tag)) {
        landedOnControl = true;
        break;
      }
    }
    expect(landedOnControl).toBe(true);
  });
});
