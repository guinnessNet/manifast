import { createRoot } from "react-dom/client";
import JSZip from "jszip";
import { toPng } from "html-to-image";
import type { WireframeMeta } from "@shared/types";
import type { Screen } from "@shared/schema/wireframe";
import { fetchFile } from "../../lib/api";
import { downloadBlob, safeFilename } from "../../lib/export";
import { ScreenRenderer } from "./Renderer";
import { loadFullIcons } from "./nodes";

/**
 * Render every wireframe offscreen (the same inline-styled DOM the canvas uses)
 * and download a ZIP of 2x PNGs — a 10-screen flow becomes one click instead of
 * 10 × (select → Export → PNG).
 */
export async function exportAllScreensPNG(wireframes: WireframeMeta[], zipName = "wireframes"): Promise<void> {
  const valid = wireframes.filter((w) => w.ok);
  if (valid.length === 0) throw new Error("No wireframes available to export");

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  const zip = new JSZip();
  // Screen ids across files aren't enforced unique (and sanitization can
  // collapse distinct names) — suffix duplicates so no ZIP entry is overwritten.
  const usedNames = new Set<string>();
  const uniqueName = (base: string): string => {
    let name = base;
    for (let i = 2; usedNames.has(name); i++) name = `${base}-${i}`;
    usedNames.add(name);
    return name;
  };
  try {
    await document.fonts?.ready;
    // Icons outside the curated set resolve from the lazy registry — load it up
    // front so offscreen snapshots don't capture placeholder boxes.
    await loadFullIcons();
    for (const wf of valid) {
      const file = await fetchFile(wf.path);
      if (file.kind !== "wireframe" || !file.ok || !file.data) continue;
      const screen: Screen = file.data;
      const el = await new Promise<HTMLDivElement>((resolve) => {
        // Key by screen id so each iteration remounts and the ref fires fresh.
        root.render(
          <div key={screen.id}>
            <ScreenRenderer
              screen={screen}
              innerRef={(node) => {
                if (node) resolve(node);
              }}
            />
          </div>,
        );
      });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
      zip.file(`${uniqueName(safeFilename(screen.id || wf.name))}.png`, dataUrl.slice(dataUrl.indexOf(",") + 1), { base64: true });
    }
  } finally {
    root.unmount();
    host.remove();
  }
  downloadBlob(`${safeFilename(zipName)}-screens.zip`, await zip.generateAsync({ type: "blob" }));
}
