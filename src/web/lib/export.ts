import { toPng, toSvg } from "html-to-image";
import JSZip from "jszip";
import { fetchFileList, fetchRaw } from "./api";

// Inlined into exported standalone HTML so rendered docs are self-contained.
export const PROSE_CSS = `
body{margin:0;background:#fff;color:#374151;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Malgun Gothic",sans-serif;}
.mf-prose{line-height:1.7;font-size:15px;max-width:820px;margin:2rem auto;padding:0 1.5rem;}
.mf-prose h1{font-size:1.6rem;font-weight:700;margin:1.4rem 0 .8rem;}
.mf-prose h2{font-size:1.3rem;font-weight:700;margin:1.3rem 0 .6rem;border-bottom:1px solid #ececec;padding-bottom:.3rem;}
.mf-prose h3{font-size:1.1rem;font-weight:600;margin:1.1rem 0 .5rem;}
.mf-prose p{margin:.6rem 0;}
.mf-prose ul{list-style:disc;padding-left:1.4rem;margin:.6rem 0;}
.mf-prose ol{list-style:decimal;padding-left:1.4rem;margin:.6rem 0;}
.mf-prose li{margin:.25rem 0;}
.mf-prose a{color:#2563eb;text-decoration:underline;}
.mf-prose code{background:#f3f4f6;padding:.1rem .35rem;border-radius:4px;font-size:.85em;font-family:ui-monospace,Menlo,monospace;}
.mf-prose pre{background:#f6f8fa;padding:1rem;border-radius:8px;overflow:auto;margin:.8rem 0;border:1px solid #ececec;}
.mf-prose pre code{background:none;padding:0;}
.mf-prose blockquote{border-left:3px solid #d0d0d0;padding-left:1rem;color:#6b7280;margin:.8rem 0;}
.mf-prose table{border-collapse:collapse;margin:.8rem 0;width:100%;}
.mf-prose th,.mf-prose td{border:1px solid #e2e2e2;padding:.45rem .7rem;text-align:left;}
.mf-prose th{background:#f5f5f5;font-weight:600;}
.mf-prose hr{border:none;border-top:1px solid #e2e2e2;margin:1.2rem 0;}
`;

// Strip only filesystem-hostile characters — Korean (or any unicode) titles
// must survive as filenames instead of collapsing to "manifast".
export function safeFilename(name: string): string {
  return safe(name);
}
function safe(name: string): string {
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
      .replace(/\s+/g, " ")
      .replace(/^[_ .]+|[_ .]+$/g, "") || "manifast"
  );
}

/** The themed canvas color, so exports match what the user sees (dark included). */
export function themeBackground(): string {
  const root = document.getElementById("mf-root") ?? document.documentElement;
  return getComputedStyle(root).getPropertyValue("--bg").trim() || "#ffffff";
}

// html-to-image clones the subtree but the clone loses CSS custom properties
// declared on ANCESTORS outside it (#mf-root) — SVG attributes like
// stroke="var(--edge)" then resolve to nothing and edges vanish from exports.
// Temporarily inline every known custom property on the element so the clone
// carries them; restore afterwards.
function collectCssVarNames(): string[] {
  const names = new Set<string>();
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      const style = (rule as CSSStyleRule).style;
      if (style) {
        for (let i = 0; i < style.length; i++) {
          const p = style[i];
          if (p.startsWith("--")) names.add(p);
        }
      }
      const inner = (rule as CSSGroupingRule).cssRules;
      if (inner) walk(inner);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      /* cross-origin sheet — skip */
    }
  }
  return [...names];
}

async function withInlinedCssVars<T>(el: HTMLElement, fn: () => Promise<T>): Promise<T> {
  const root = el.closest("#mf-root") ?? document.documentElement;
  const computed = getComputedStyle(root);
  const added: string[] = [];
  for (const name of collectCssVarNames()) {
    if (el.style.getPropertyValue(name)) continue; // don't clobber explicit inline vars
    const value = computed.getPropertyValue(name);
    if (value) {
      el.style.setProperty(name, value);
      added.push(name);
    }
  }
  try {
    return await fn();
  } finally {
    for (const name of added) el.style.removeProperty(name);
  }
}

/** Keep rasterized pixels under browser canvas limits for huge project maps. */
function safePixelRatio(el: HTMLElement, want = 2): number {
  const area = Math.max(1, el.offsetWidth * el.offsetHeight);
  const budget = 60_000_000; // px² — comfortably below Chrome/Safari canvas caps
  return Math.max(1, Math.min(want, Math.sqrt(budget / area)));
}

function triggerDownload(filename: string, href: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function downloadText(filename: string, text: string, mime: string): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

// --- Wireframe -------------------------------------------------------------

export async function exportPNG(el: HTMLElement, name: string, background = "#ffffff"): Promise<void> {
  const dataUrl = await withInlinedCssVars(el, () =>
    toPng(el, { pixelRatio: safePixelRatio(el), cacheBust: true, backgroundColor: background }),
  );
  triggerDownload(`${safe(name)}.png`, dataUrl);
}

export async function exportSVG(el: HTMLElement, name: string, background = "#ffffff"): Promise<void> {
  const dataUrl = await withInlinedCssVars(el, () => toSvg(el, { cacheBust: true, backgroundColor: background }));
  triggerDownload(`${safe(name)}.svg`, dataUrl);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function standaloneHtml(el: HTMLElement, title: string, extraCss: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>html,body{margin:0;background:#fff;}${extraCss}</style>
</head><body>${el.outerHTML}</body></html>`;
}

/** Serialize a rendered DOM subtree as standalone HTML (node styles are inline). */
export function exportNodeHTML(el: HTMLElement, name: string, extraCss = ""): void {
  downloadText(`${safe(name)}.html`, standaloneHtml(el, name, extraCss), "text/html;charset=utf-8");
}

/**
 * Print a doc via a standalone window instead of window.print() on the app —
 * printing the SPA includes the sidebar/toolbars and clips anything scrolled
 * inside the overflow pane to a single page (and dark theme prints near-white
 * text). The standalone copy is plain light-themed prose in static flow.
 */
export function printNodeHTML(el: HTMLElement, title: string, extraCss = ""): void {
  const w = window.open("", "_blank", "noopener=false");
  if (!w) throw new Error("Pop-up blocked — can't open the print window");
  w.document.write(standaloneHtml(el, title, extraCss));
  w.document.close();
  // Give the new window a beat to lay out (and load webfonts) before printing.
  w.setTimeout(() => {
    w.focus();
    w.print();
  }, 300);
}

// --- Raw passthrough (JSON / MD) ------------------------------------------

export async function exportRaw(path: string, filename: string, mime: string): Promise<void> {
  const raw = await fetchRaw(path);
  downloadText(safe(filename), raw, mime);
}

// --- Whole workspace ZIP ---------------------------------------------------

export async function exportZip(projectName: string): Promise<void> {
  const files = await fetchFileList();
  const zip = new JSZip();
  await Promise.all(
    files.map(async (p) => {
      // Paths from /api/files are already project-root-relative (".manifast/…"),
      // so they map straight to archive entries — extracting into a project root
      // reproduces the workspace without double nesting.
      zip.file(p, await fetchRaw(p));
    }),
  );
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(`${safe(projectName)}-manifast.zip`, blob);
}
