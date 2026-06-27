import { useEffect, useRef, useState } from "react";
import { LayoutGrid, FileText, Link2 } from "lucide-react";
import type { TasksData } from "@shared/types";
import type { Task, TaskStatus, TaskPriority } from "@shared/schema/tasks";
import type { LinkGraph } from "../../lib/links";
import { ErrorBanner } from "../ErrorBanner";
import { LinkChip } from "../LinkChip";
import { cn } from "../../lib/cn";

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
  { key: "blocked", label: "Blocked" },
];

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: "var(--accent)",
  med: "var(--text-muted)",
  low: "var(--text-faint)",
};

export interface BoardProps {
  tasksData: TasksData | null;
  graph: LinkGraph;
  highlightTask?: string;
}

export function Board({ tasksData, graph, highlightTask }: BoardProps) {
  const [priority, setPriority] = useState<TaskPriority | "all">("all");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flash, setFlash] = useState<string | undefined>();

  useEffect(() => {
    if (!highlightTask) return;
    const el = cardRefs.current[highlightTask];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(highlightTask);
    const t = setTimeout(() => setFlash(undefined), 1600);
    return () => clearTimeout(t);
  }, [highlightTask]);

  if (!tasksData) {
    return <div className="grid h-full place-items-center text-sm text-[var(--text-faint)]">tasks/tasks.json 이 없습니다.</div>;
  }
  if (!tasksData.ok) {
    return (
      <div className="p-4">
        <ErrorBanner path={tasksData.path} message={tasksData.error ?? "tasks.json 파싱 실패"} />
      </div>
    );
  }

  const all = tasksData.tasks;
  const tasks = priority === "all" ? all : all.filter((t) => (t.priority ?? "med") === priority);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-2.5 text-sm">
        <span className="font-medium text-[var(--text)]">{all.length} tasks</span>
        <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
          {COLUMNS.map((c) => (
            <span key={c.key}>
              {c.label}: {all.filter((t) => t.status === c.key).length}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-xs text-[var(--text-faint)]">priority</span>
          {(["all", "high", "med", "low"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={cn(
                "rounded-md px-2 py-1 text-xs capitalize transition-colors",
                priority === p ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--text-muted)] hover:bg-[var(--border-soft)]",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-4 gap-3 overflow-auto bg-[var(--bg)] p-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              className={cn(
                "flex min-w-0 flex-col rounded-lg border",
                col.key === "blocked"
                  ? "border-[var(--err-border)] bg-[var(--err-bg)]"
                  : "border-[var(--border)] bg-[var(--bg-elevated)]",
              )}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-semibold text-[var(--text)]">{col.label}</span>
                <span className="text-xs text-[var(--text-faint)]">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2 px-2 pb-2">
                {items.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    graph={graph}
                    flash={flash === t.id}
                    cardRef={(el) => (cardRefs.current[t.id] = el)}
                  />
                ))}
                {items.length === 0 && <div className="px-2 py-3 text-xs text-[var(--text-faint)]">—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  graph,
  flash,
  cardRef,
}: {
  task: Task;
  graph: LinkGraph;
  flash: boolean;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const spec = task.specId ? graph.docById(task.specId) : undefined;
  const wf = task.wireframeId ? graph.wireframeById(task.wireframeId) : undefined;
  return (
    <div
      ref={cardRef}
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 shadow-sm transition",
        flash && "ring-2 ring-[var(--accent)]",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ background: PRIORITY_COLOR[task.priority ?? "med"] }}
          title={`priority: ${task.priority ?? "med"}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--text)]">{task.title}</div>
          {task.description && <div className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">{task.description}</div>}
        </div>
      </div>

      {(task.specId || task.wireframeId) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {task.specId && (
            <LinkChip
              target={{ kind: "doc", id: task.specId }}
              exists={graph.hasDoc(task.specId)}
              label={spec?.title ?? task.specId}
              icon={<FileText size={11} />}
            />
          )}
          {task.wireframeId && (
            <LinkChip
              target={{ kind: "wireframe", id: task.wireframeId }}
              exists={graph.hasWireframe(task.wireframeId)}
              label={wf?.name ?? task.wireframeId}
              icon={<LayoutGrid size={11} />}
            />
          )}
        </div>
      )}

      {task.deps && task.deps.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Link2 size={12} className="text-[var(--text-faint)]" />
          {task.deps.map((d) => {
            const exists = graph.hasTask(d);
            const dep = graph.taskById(d);
            return (
              <LinkChip
                key={d}
                target={{ kind: "task", id: d }}
                exists={exists}
                label={dep?.title ?? d}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
