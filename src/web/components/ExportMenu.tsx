import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Download,
  ChevronDown,
  FileImage,
  FileCode,
  FileJson,
  FileText,
  Printer,
  Archive,
} from "lucide-react";
import type { Screen } from "@shared/schema/wireframe";
import type { WireframeMeta } from "@shared/types";
import { Button } from "./ui/button";
import {
  exportPNG,
  exportSVG,
  exportNodeHTML,
  printNodeHTML,
  exportRaw,
  exportZip,
  themeBackground,
  PROSE_CSS,
} from "../lib/export";
import { exportAllScreensPNG } from "./wireframe/exportAllScreens";

/** Reject with a visible message instead of silently closing the menu. */
function must<T>(v: T | null | undefined, msg: string): T {
  if (!v) throw new Error(msg);
  return v;
}

interface Item {
  label: string;
  icon?: ReactNode;
  onClick: () => void | Promise<void>;
}

function Dropdown({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const run = async (fn: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert("Export 실패: " + (e as Error).message);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} disabled={busy}>
        <Download size={14} />
        {busy ? "Exporting…" : "Export"}
        <ChevronDown size={14} />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-[0_10px_32px_rgba(0,0,0,0.14)]">
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => run(it.onClick)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--accent-soft)]"
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WireframeExportMenu({
  screen,
  screenRef,
  path,
  allWireframes,
}: {
  screen: Screen;
  screenRef: RefObject<HTMLDivElement | null>;
  path: string;
  /** When >1 screens exist, offer a one-click ZIP of every screen's PNG. */
  allWireframes?: WireframeMeta[];
}) {
  const name = screen.id || screen.name || "wireframe";
  const notReady = "화면이 아직 렌더되지 않았습니다";
  const items: Item[] = [
    { label: "PNG", icon: <FileImage size={14} />, onClick: () => exportPNG(must(screenRef.current, notReady), name) },
    { label: "SVG", icon: <FileCode size={14} />, onClick: () => exportSVG(must(screenRef.current, notReady), name) },
    { label: "HTML", icon: <FileCode size={14} />, onClick: () => exportNodeHTML(must(screenRef.current, notReady), name) },
    { label: "JSON", icon: <FileJson size={14} />, onClick: () => exportRaw(path, `${name}.json`, "application/json") },
  ];
  if (allWireframes && allWireframes.length > 1) {
    items.push({
      label: `PNG 전체 (${allWireframes.length}장 ZIP)`,
      icon: <Archive size={14} />,
      onClick: () => exportAllScreensPNG(allWireframes),
    });
  }
  return <Dropdown items={items} />;
}

export function MapExportMenu({
  contentRef,
  name,
  path,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
  name: string;
  /** When set (an authored diagram), offer the raw JSON too. Omitted for the auto project map. */
  path?: string;
}) {
  // PNG/SVG only: map nodes use CSS vars (var(--accent) …) so standalone-HTML
  // serialization would lose colors; html-to-image rasterizes computed styles fine.
  // Export against the CURRENT theme's canvas color so dark-mode maps don't land
  // half-dark on stark white.
  const notReady = "맵이 아직 렌더되지 않았습니다";
  const items: Item[] = [
    { label: "PNG", icon: <FileImage size={14} />, onClick: () => exportPNG(must(contentRef.current, notReady), name, themeBackground()) },
    { label: "SVG", icon: <FileCode size={14} />, onClick: () => exportSVG(must(contentRef.current, notReady), name, themeBackground()) },
  ];
  if (path) items.push({ label: "JSON", icon: <FileJson size={14} />, onClick: () => exportRaw(path, `${name}.json`, "application/json") });
  return <Dropdown items={items} />;
}

export function DocExportMenu({
  docRef,
  path,
  name,
}: {
  docRef: RefObject<HTMLDivElement | null>;
  path: string;
  name: string;
}) {
  const notReady = "문서가 아직 렌더되지 않았습니다";
  return (
    <Dropdown
      items={[
        { label: "Markdown", icon: <FileText size={14} />, onClick: () => exportRaw(path, `${name}.md`, "text/markdown") },
        { label: "HTML", icon: <FileCode size={14} />, onClick: () => exportNodeHTML(must(docRef.current, notReady), name, PROSE_CSS) },
        { label: "Print / PDF", icon: <Printer size={14} />, onClick: () => printNodeHTML(must(docRef.current, notReady), name, PROSE_CSS) },
      ]}
    />
  );
}

export function ZipButton({ projectName }: { projectName: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await exportZip(projectName);
        } catch (e) {
          console.error(e);
          alert("ZIP export 실패: " + (e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      title="Download the whole .manifast/ as a ZIP"
    >
      <Archive size={14} />
      {busy ? "Zipping…" : ".zip"}
    </Button>
  );
}
