import { KanbanSquare } from "lucide-react";
import type { PlanData } from "@shared/types";
import type { Phase, PhaseStatus } from "@shared/schema/plan";
import type { LinkGraph } from "../../lib/links";
import { Badge } from "../ui/badge";
import { ErrorBanner } from "../ErrorBanner";
import { LinkChip } from "../LinkChip";
import { cn } from "../../lib/cn";

const STATUS_TONE: Record<PhaseStatus, "neutral" | "info" | "success"> = {
  planned: "neutral",
  active: "info",
  done: "success",
};
const DOT: Record<PhaseStatus, string> = {
  planned: "bg-[var(--text-faint)]",
  active: "bg-[var(--accent)]",
  done: "bg-[var(--ok)]",
};

export interface RoadmapProps {
  planData: PlanData | null;
  graph: LinkGraph;
}

export function Roadmap({ planData, graph }: RoadmapProps) {
  if (!planData) {
    return <div className="grid h-full place-items-center text-sm text-[var(--text-faint)]">No plan/plan.json yet.</div>;
  }
  if (!planData.ok) {
    return (
      <div className="p-4">
        <ErrorBanner path={planData.path} message={planData.error ?? "Failed to parse plan.json"} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col">
        {planData.phases.map((phase, i) => (
          <PhaseRow key={phase.id} phase={phase} graph={graph} last={i === planData.phases.length - 1} />
        ))}
        {planData.phases.length === 0 && <p className="text-sm text-[var(--text-faint)]">No phases yet.</p>}
      </div>
    </div>
  );
}

function PhaseRow({ phase, graph, last }: { phase: Phase; graph: LinkGraph; last: boolean }) {
  const status = phase.status ?? "planned";
  const ids = phase.taskIds ?? [];
  const existing = ids.filter((id) => graph.hasTask(id));
  const broken = ids.filter((id) => !graph.hasTask(id));
  const total = existing.length;
  const done = existing.filter((id) => graph.taskById(id)?.status === "done").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className={cn("mt-1.5 h-3 w-3 shrink-0 rounded-full ring-4 ring-[var(--bg)]", DOT[status])} />
        {!last && <span className="my-1 w-px flex-1 bg-[var(--border)]" />}
      </div>

      <div className="mb-5 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--text)]">{phase.name}</h3>
          <Badge tone={STATUS_TONE[status]}>{status}</Badge>
        </div>
        {phase.goal && <p className="mt-1 text-sm text-[var(--text-muted)]">{phase.goal}</p>}

        {ids.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-faint)]">
              <span>progress</span>
              <span>
                {done}/{total} done
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-soft)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {existing.map((id) => {
                const t = graph.taskById(id);
                return (
                  <LinkChip
                    key={id}
                    target={{ kind: "task", id }}
                    exists
                    label={t?.title ?? id}
                    icon={<KanbanSquare size={11} />}
                  />
                );
              })}
              {broken.map((id) => (
                <LinkChip key={id} target={{ kind: "task", id }} exists={false} label={id} icon={<KanbanSquare size={11} />} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
