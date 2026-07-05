import { useRef } from "react";
import { Smartphone, Tablet, Monitor, FileText, KanbanSquare, AlertTriangle } from "lucide-react";
import type { WireframeMeta } from "@shared/types";
import type { LinkGraph } from "../../lib/links";
import { useFile } from "../../hooks/useFile";
import { Canvas } from "./Canvas";
import { ScreenRenderer } from "./Renderer";
import { WireframeThumb } from "./WireframeThumb";
import { ErrorBanner } from "../ErrorBanner";
import { LinkChip } from "../LinkChip";
import { WireframeExportMenu } from "../ExportMenu";

export interface WireframeViewProps {
  wireframes: WireframeMeta[];
  path?: string;
  onSelect: (path: string) => void;
  meta?: WireframeMeta;
  graph: LinkGraph;
  tick: number;
}

function deviceIcon(device?: string) {
  return device === "mobile" ? Smartphone : device === "tablet" ? Tablet : Monitor;
}

export function WireframeView({ wireframes, path, onSelect, meta, graph, tick }: WireframeViewProps) {
  const { file, loading } = useFile(path, tick);
  const screenRef = useRef<HTMLDivElement>(null);

  if (!path) {
    return (
      <div className="grid h-full place-items-center text-sm text-[var(--text-faint)]">
        표시할 와이어프레임이 없습니다.
      </div>
    );
  }

  const screen = file && file.kind === "wireframe" ? file.data : null;
  const errMsg =
    file && file.kind === "wireframe" && !file.ok ? file.error : meta && !meta.ok ? meta.error : null;

  const DeviceIcon = deviceIcon(meta?.device);
  const specs = meta ? graph.specsForWireframe(meta.id) : [];
  const tasks = meta ? graph.tasksForWireframe(meta.id) : [];

  return (
    <div className="flex h-full flex-col">
      {/* slim toolbar: device + name + size, link chips, per-screen export */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2">
        <div className="flex items-center gap-2">
          <DeviceIcon size={15} className="text-[var(--text-faint)]" />
          <span className="text-sm font-medium text-[var(--text)]">{meta?.name ?? screen?.name ?? path}</span>
          {screen && (
            <span className="text-xs text-[var(--text-faint)]">
              {screen.device} · {screen.size.w}×{screen.size.h}
            </span>
          )}
        </div>

        {(specs.length > 0 || tasks.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {specs.map((s) => (
              <LinkChip key={s.path} target={{ kind: "doc", id: s.id }} exists label={s.title} icon={<FileText size={11} />} />
            ))}
            {tasks.map((t) => (
              <LinkChip key={t.id} target={{ kind: "task", id: t.id }} exists label={t.title} icon={<KanbanSquare size={11} />} />
            ))}
          </div>
        )}

        <div className="ml-auto">
          {screen && <WireframeExportMenu screen={screen} screenRef={screenRef} path={path} allWireframes={wireframes} />}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {errMsg ? (
          <div className="p-4">
            <ErrorBanner path={path} message={errMsg} />
          </div>
        ) : screen ? (
          <Canvas contentW={screen.size.w} contentH={screen.size.h} fitKey={screen.id}>
            <div style={{ boxShadow: "0 6px 30px rgba(0,0,0,0.07)" }}>
              <ScreenRenderer screen={screen} innerRef={screenRef} />
            </div>
          </Canvas>
        ) : (
          <div className="grid h-full place-items-center text-sm text-[var(--text-faint)]">
            {loading ? "Loading…" : ""}
          </div>
        )}
      </div>

      {/* bottom "Screens" thumbnail strip */}
      {wireframes.length > 0 && (
        <div className="flex h-[122px] shrink-0 items-center gap-4 overflow-x-auto border-t border-[var(--border)] bg-[var(--bg-elevated)] px-5">
          <span
            className="flex h-[78px] shrink-0 items-center self-center text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-faint)]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            Screens
          </span>
          {wireframes.map((w) => {
            const Icon = deviceIcon(w.device);
            const active = w.path === path;
            return (
              <div key={w.path} className="flex shrink-0 flex-col items-center gap-[7px]">
                <WireframeThumb path={w.path} tick={tick} maxW={130} maxH={83} active={active} onClick={() => onSelect(w.path)} />
                <span
                  className={
                    "flex items-center gap-1 text-[11.5px] " +
                    (active ? "font-semibold text-[var(--accent)]" : "font-medium text-[var(--text-muted)]")
                  }
                >
                  <Icon size={11} className="text-[var(--text-faint)]" />
                  {w.name}
                  {!w.ok && <AlertTriangle size={11} className="text-[var(--err-text)]" />}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
