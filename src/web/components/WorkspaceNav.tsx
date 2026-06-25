import type { WorkspaceDTO } from "@shared/types";
import type { View } from "../lib/nav";
import { cn } from "../lib/cn";
import { LayoutGrid, FileText, Columns3, Route, Network, Folder } from "lucide-react";

const VIEWS: { key: View; label: string; icon: typeof LayoutGrid }[] = [
  { key: "wireframes", label: "Wireframes", icon: LayoutGrid },
  { key: "docs", label: "Docs", icon: FileText },
  { key: "tasks", label: "Tasks", icon: Columns3 },
  { key: "plan", label: "Plan", icon: Route },
  { key: "map", label: "Map", icon: Network },
];

export interface WorkspaceNavProps {
  data: WorkspaceDTO;
  view: View;
  onView: (v: View) => void;
}

export function WorkspaceNav({ data, view, onView }: WorkspaceNavProps) {
  const counts: Record<View, number> = {
    wireframes: data.items.wireframes.length,
    docs: data.items.docs.length,
    tasks: data.items.tasks?.tasks.length ?? 0,
    plan: data.items.plan?.phases.length ?? 0,
    map: data.items.diagrams.length,
  };

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)]">
      <div className="flex items-center gap-2.5 px-5 pb-3.5 pt-[18px]">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-[var(--accent-fg)]">
          M
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13.5px] font-semibold text-[var(--text)]">
            {data.project.name}
          </span>
          <span className="truncate text-[11.5px] text-[var(--text-faint)]">
            {data.project.description || "Manifast"}
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 py-1.5">
        <div className="px-2.5 pb-1.5 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-faint)]">
          Views
        </div>
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.key;
          return (
            <button
              key={v.key}
              onClick={() => onView(v.key)}
              className={cn(
                "flex items-center gap-[11px] rounded-lg px-[11px] py-2 text-[13px] transition-colors",
                active
                  ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                  : "font-medium text-[var(--text-muted)] hover:bg-[var(--accent-soft)]",
              )}
            >
              <Icon size={17} className="shrink-0" />
              <span className="truncate">{v.label}</span>
              <span
                className={cn(
                  "ml-auto text-[11px] tabular-nums",
                  active ? "text-[var(--accent)]" : "text-[var(--text-faint)]",
                )}
              >
                {counts[v.key]}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t border-[var(--border)] px-5 py-3.5">
        <Folder size={13} className="shrink-0 text-[var(--text-faint)]" />
        <span className="truncate font-mono text-[11px] text-[var(--text-faint)]">.manifast/</span>
      </div>
    </aside>
  );
}
