import { useCallback, useEffect, useMemo, useState } from "react";
import type { WsMessage } from "@shared/types";
import { Sun, Moon, Check, ChevronRight } from "lucide-react";
import { useWorkspace } from "./hooks/useWorkspace";
import { useLiveReload, type ConnStatus } from "./hooks/useLiveReload";
import { WorkspaceNav } from "./components/WorkspaceNav";
import { ErrorBanner } from "./components/ErrorBanner";
import { NavContext, type NavTarget, type View } from "./lib/nav";
import { buildLinkGraph } from "./lib/links";
import { WireframeView } from "./components/wireframe/WireframeView";
import { DocView } from "./components/docs/DocView";
import { Board } from "./components/tasks/Board";
import { Roadmap } from "./components/plan/Roadmap";
import { MapView } from "./components/diagram/MapView";
import { ZipButton } from "./components/ExportMenu";

const TITLES: Record<View, string> = {
  wireframes: "Wireframes",
  docs: "Docs",
  tasks: "Tasks",
  plan: "Plan",
  flow: "User Flow",
  tree: "Tree",
  map: "Map",
};

type Theme = "light" | "dark";
type Accent = "indigo" | "emerald" | "orange" | "blue";
const ACCENTS: { key: Accent; swatch: string }[] = [
  { key: "indigo", swatch: "#6366f1" },
  { key: "emerald", swatch: "#10b981" },
  { key: "orange", swatch: "#f97316" },
  { key: "blue", swatch: "#3b82f6" },
];

function initialTheme(): Theme {
  const saved = localStorage.getItem("mf-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function initialAccent(): Accent {
  const saved = localStorage.getItem("mf-accent");
  return saved === "emerald" || saved === "orange" || saved === "blue" ? saved : "indigo";
}

export default function App() {
  const { data, error, loading, refetch } = useWorkspace();
  const [view, setView] = useState<View>("wireframes");
  const [selWf, setSelWf] = useState<string>();
  const [selDoc, setSelDoc] = useState<string>();
  const [highlightTask, setHighlightTask] = useState<string>();
  const [reloadTick, setReloadTick] = useState(0);
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [accent, setAccent] = useState<Accent>(initialAccent);

  useEffect(() => {
    localStorage.setItem("mf-theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("mf-accent", accent);
  }, [accent]);

  const onMessage = useCallback(
    (m: WsMessage) => {
      void refetch();
      setReloadTick((t) => t + 1);
      setToast({ msg: `${m.type === "unlink" ? "removed" : "updated"} · ${m.path}`, id: Date.now() });
    },
    [refetch],
  );
  const onResync = useCallback(() => {
    void refetch();
    setReloadTick((t) => t + 1);
  }, [refetch]);
  const status = useLiveReload(onMessage, onResync);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  // Default + recover selections as the workspace changes.
  useEffect(() => {
    if (!data) return;
    const wfPaths = data.items.wireframes.map((w) => w.path);
    setSelWf((prev) => (prev && wfPaths.includes(prev) ? prev : wfPaths[0]));
    const docPaths = data.items.docs.map((d) => d.path);
    setSelDoc((prev) => (prev && docPaths.includes(prev) ? prev : docPaths[0]));
  }, [data]);

  const graph = useMemo(() => (data ? buildLinkGraph(data) : null), [data]);

  const navigate = useCallback(
    (t: NavTarget) => {
      if (!data) return;
      if (t.kind === "wireframe") {
        const w = data.items.wireframes.find((x) => x.id === t.id);
        if (w) {
          setSelWf(w.path);
          setView("wireframes");
        }
      } else if (t.kind === "doc") {
        const d = data.items.docs.find((x) => x.id === t.id || x.uid === t.id);
        if (d) {
          setSelDoc(d.path);
          setView("docs");
        }
      } else if (t.kind === "task") {
        setHighlightTask(t.id);
        setView("tasks");
      } else if (t.kind === "plan") {
        setView("plan");
      }
    },
    [data],
  );

  if (!data) {
    return (
      <div id="mf-root" data-theme={theme} data-accent={accent} className="grid h-screen place-items-center p-8">
        {error ? (
          <ErrorBanner message={`Cannot connect to server: ${error}`} />
        ) : (
          <p className="text-sm text-[var(--text-faint)]">{loading ? "Loading…" : ""}</p>
        )}
      </div>
    );
  }

  const selWfMeta = data.items.wireframes.find((w) => w.path === selWf);
  const selDocMeta = data.items.docs.find((d) => d.path === selDoc);

  // Header breadcrumb: wireframe name / doc title.
  const crumb =
    view === "wireframes" ? selWfMeta?.name : view === "docs" ? selDocMeta?.title : undefined;
  const taskCount = data.items.tasks?.tasks.length ?? 0;

  return (
    <NavContext.Provider value={navigate}>
      <div id="mf-root" data-theme={theme} data-accent={accent} className="flex h-screen overflow-hidden">
        <WorkspaceNav data={data} view={view} onView={setView} />

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[53px] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-[18px]">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-sm font-semibold text-[var(--text)]">{TITLES[view]}</span>
              {crumb && (
                <>
                  <ChevronRight size={13} className="shrink-0 text-[var(--text-faint)]" />
                  <span
                    className={
                      view === "wireframes"
                        ? "truncate font-mono text-xs text-[var(--text-muted)]"
                        : "truncate text-xs font-medium text-[var(--text-muted)]"
                    }
                  >
                    {crumb}
                  </span>
                </>
              )}
              {view === "tasks" && taskCount > 0 && (
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 py-px text-[11px] font-semibold text-[var(--text-muted)]">
                  {taskCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <LivePill status={status} />
              <ZipButton projectName={data.project.name} />
              <AccentPicker accent={accent} onAccent={setAccent} />
              <ThemeToggle theme={theme} onToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} />
            </div>
          </header>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--bg)]">
            {graph && view === "wireframes" && (
              <WireframeView
                wireframes={data.items.wireframes}
                path={selWf}
                onSelect={setSelWf}
                meta={selWfMeta}
                graph={graph}
                tick={reloadTick}
              />
            )}
            {graph && view === "docs" && (
              <DocView
                docs={data.items.docs}
                path={selDoc}
                onSelect={setSelDoc}
                meta={selDocMeta}
                graph={graph}
                tick={reloadTick}
              />
            )}
            {graph && view === "tasks" && (
              <Board tasksData={data.items.tasks} graph={graph} highlightTask={highlightTask} />
            )}
            {graph && view === "plan" && <Roadmap planData={data.items.plan} graph={graph} />}
            {view === "flow" && <MapView data={data} tick={reloadTick} mode="flow" />}
            {view === "tree" && <MapView data={data} tick={reloadTick} mode="tree" />}
            {view === "map" && <MapView data={data} tick={reloadTick} />}
          </div>
        </main>

        {toast && (
          <div className="mf-flash pointer-events-none fixed bottom-4 right-4 z-50 rounded-md bg-[var(--text)] px-3 py-2 text-xs text-[var(--bg-elevated)] shadow-lg">
            {toast.msg}
          </div>
        )}
      </div>
    </NavContext.Provider>
  );
}

function LivePill({ status }: { status: ConnStatus }) {
  const map: Record<ConnStatus, { color: string; label: string; pulse: boolean }> = {
    open: { color: "#22c55e", label: "Live", pulse: true },
    connecting: { color: "#f59e0b", label: "Connecting…", pulse: true },
    closed: { color: "#ef4444", label: "Offline", pulse: false },
  };
  const s = map[status];
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] py-[5px] pl-2.5 pr-3" title={s.label}>
      <span
        className="h-[7px] w-[7px] rounded-full"
        style={{
          background: s.color,
          boxShadow: `0 0 0 3px ${s.color}2e`,
          animation: s.pulse ? "mf-pulse 2s ease-in-out infinite" : undefined,
        }}
      />
      <span className="text-[11.5px] font-medium text-[var(--text-muted)]">{s.label}</span>
    </div>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      className="flex h-8 w-[34px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--border-soft)]"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function AccentPicker({ accent, onAccent }: { accent: Accent; onAccent: (a: Accent) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [open]);
  const current = ACCENTS.find((a) => a.key === accent) ?? ACCENTS[0];

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Accent color"
        title="Accent color"
        className="flex h-8 w-[34px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] hover:bg-[var(--border-soft)]"
      >
        <span className="h-3.5 w-3.5 rounded-full" style={{ background: current.swatch }} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 flex gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-[0_10px_32px_rgba(0,0,0,0.14)]">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              onClick={() => {
                onAccent(a.key);
                setOpen(false);
              }}
              aria-label={a.key}
              title={a.key}
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: a.swatch }}
            >
              {a.key === accent && <Check size={14} className="text-white" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
