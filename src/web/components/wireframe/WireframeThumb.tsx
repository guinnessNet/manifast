import { AlertTriangle } from "lucide-react";
import { useFile } from "../../hooks/useFile";
import { ScreenRenderer } from "./Renderer";

export interface WireframeThumbProps {
  path: string;
  tick: number;
  maxW?: number;
  maxH?: number;
  active?: boolean;
  onClick?: () => void;
}

export function WireframeThumb({ path, tick, maxW = 240, maxH = 200, active, onClick }: WireframeThumbProps) {
  const { file, loading } = useFile(path, tick);
  const screen = file && file.kind === "wireframe" ? file.data : null;
  // Keep the strip layout stable: skeleton while loading, a flagged placeholder
  // for invalid files — never a label floating with no box.
  if (!screen) {
    return (
      <button
        onClick={onClick}
        title={loading ? "Loading…" : `Can't open: ${path}`}
        className={
          "relative block overflow-hidden rounded-md border bg-[var(--bg-elevated)] " +
          (loading ? "animate-pulse border-[var(--border)]" : "border-[var(--err-border)] bg-[var(--err-bg)]")
        }
        style={{ width: maxW * 0.92, height: maxH }}
      >
        {!loading && (
          <span className="absolute inset-0 grid place-items-center">
            <AlertTriangle size={16} className="text-[var(--err-text)]" />
          </span>
        )}
      </button>
    );
  }

  const scale = Math.min(maxW / screen.size.w, maxH / screen.size.h, 1);
  return (
    <button
      onClick={onClick}
      title={`Open ${screen.name}`}
      className={
        "group relative block overflow-hidden rounded-md bg-[var(--bg-elevated)] shadow-sm transition " +
        (active
          ? "border border-[var(--accent)] shadow-[0_0_0_2px_var(--accent-soft)]"
          : "border border-[var(--border)] hover:border-[var(--accent-border)] hover:shadow")
      }
      style={{ width: screen.size.w * scale, height: screen.size.h * scale }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          width: screen.size.w,
          height: screen.size.h,
          pointerEvents: "none",
        }}
      >
        <ScreenRenderer screen={screen} />
      </div>
    </button>
  );
}
