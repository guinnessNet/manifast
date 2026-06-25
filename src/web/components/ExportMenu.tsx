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
import { Button } from "./ui/button";
import {
  exportPNG,
  exportSVG,
  exportNodeHTML,
  exportRaw,
  exportZip,
  PROSE_CSS,
} from "../lib/export";

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
}: {
  screen: Screen;
  screenRef: RefObject<HTMLDivElement | null>;
  path: string;
}) {
  const name = screen.id || screen.name || "wireframe";
  return (
    <Dropdown
      items={[
        { label: "PNG", icon: <FileImage size={14} />, onClick: () => { if (screenRef.current) return exportPNG(screenRef.current, name); } },
        { label: "SVG", icon: <FileCode size={14} />, onClick: () => { if (screenRef.current) return exportSVG(screenRef.current, name); } },
        { label: "HTML", icon: <FileCode size={14} />, onClick: () => { if (screenRef.current) exportNodeHTML(screenRef.current, name); } },
        { label: "JSON", icon: <FileJson size={14} />, onClick: () => exportRaw(path, `${name}.json`, "application/json") },
      ]}
    />
  );
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
  return (
    <Dropdown
      items={[
        { label: "Markdown", icon: <FileText size={14} />, onClick: () => exportRaw(path, `${name}.md`, "text/markdown") },
        { label: "HTML", icon: <FileCode size={14} />, onClick: () => { if (docRef.current) exportNodeHTML(docRef.current, name, PROSE_CSS); } },
        { label: "Print / PDF", icon: <Printer size={14} />, onClick: () => window.print() },
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
