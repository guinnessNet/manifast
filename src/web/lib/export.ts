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

function safe(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "manifast";
}

function triggerDownload(filename: string, href: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function downloadText(filename: string, text: string, mime: string): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

// --- Wireframe -------------------------------------------------------------

export async function exportPNG(el: HTMLElement, name: string): Promise<void> {
  const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
  triggerDownload(`${safe(name)}.png`, dataUrl);
}

export async function exportSVG(el: HTMLElement, name: string): Promise<void> {
  const dataUrl = await toSvg(el, { cacheBust: true });
  triggerDownload(`${safe(name)}.svg`, dataUrl);
}

/** Serialize a rendered DOM subtree as standalone HTML (node styles are inline). */
export function exportNodeHTML(el: HTMLElement, name: string, extraCss = ""): void {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${name}</title>
<style>html,body{margin:0;background:#fff;}${extraCss}</style>
</head><body>${el.outerHTML}</body></html>`;
  downloadText(`${safe(name)}.html`, html, "text/html;charset=utf-8");
}

// --- Raw passthrough (JSON / MD) ------------------------------------------

export async function exportRaw(path: string, filename: string, mime: string): Promise<void> {
  const raw = await fetchRaw(path);
  downloadText(filename, raw, mime);
}

// --- Whole workspace ZIP ---------------------------------------------------

export async function exportZip(projectName: string): Promise<void> {
  const files = await fetchFileList();
  const zip = new JSZip();
  await Promise.all(
    files.map(async (p) => {
      zip.file(`.manifast/${p}`, await fetchRaw(p));
    }),
  );
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(`${safe(projectName)}-manifast.zip`, blob);
}
