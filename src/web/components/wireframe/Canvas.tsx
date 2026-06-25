import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const MIN = 0.1;
const MAX = 4;

interface Transform {
  x: number;
  y: number;
  k: number;
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export interface CanvasProps {
  contentW: number;
  contentH: number;
  /** Refit when this changes (e.g. selected screen id). */
  fitKey: string;
  children: ReactNode;
}

export function Canvas({ contentW, contentH, fitKey, children }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [spaceDown, setSpaceDown] = useState(false);
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const pad = 64;
    const k = Math.max(MIN, Math.min(MAX, Math.min((cw - pad) / contentW, (ch - pad) / contentH, 1.5)));
    setT({ k, x: (cw - contentW * k) / 2, y: (ch - contentH * k) / 2 });
  }, [contentW, contentH]);

  useEffect(() => {
    fit();
  }, [fitKey, fit]);

  // wheel: ctrl/meta -> zoom around cursor; otherwise pan
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        setT((prev) => {
          const k = Math.max(MIN, Math.min(MAX, prev.k * Math.exp(-e.deltaY * 0.0015)));
          const ratio = k / prev.k;
          return { k, x: mx - (mx - prev.x) * ratio, y: my - (my - prev.y) * ratio };
        });
      } else if (e.shiftKey) {
        setT((prev) => ({ ...prev, x: prev.x - e.deltaY }));
      } else {
        setT((prev) => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // space-to-pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!(spaceDown || e.button === 1)) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pan.current = { sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y };
    setGrabbing(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pan.current;
    if (!p) return;
    setT((prev) => ({ ...prev, x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) }));
  };
  const endPan = () => {
    pan.current = null;
    setGrabbing(false);
  };

  const zoomBy = (factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const mx = el.clientWidth / 2;
    const my = el.clientHeight / 2;
    setT((prev) => {
      const k = Math.max(MIN, Math.min(MAX, prev.k * factor));
      const ratio = k / prev.k;
      return { k, x: mx - (mx - prev.x) * ratio, y: my - (my - prev.y) * ratio };
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden bg-[var(--bg)]"
      style={{ cursor: grabbing ? "grabbing" : spaceDown ? "grab" : "default", touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
    >
      {/* dot-grid that tracks pan/zoom */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(var(--grid-dot) 1px, transparent 1px)",
          backgroundSize: `${24 * t.k}px ${24 * t.k}px`,
          backgroundPosition: `${t.x}px ${t.y}px`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-px rounded-[9px] border border-[var(--border)] bg-[var(--bg-elevated)] p-[3px] shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
        <button
          onClick={() => zoomBy(1 / 1.2)}
          className="flex h-[26px] w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--border-soft)]"
          title="Zoom out"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <span className="min-w-[48px] text-center font-mono text-xs font-medium text-[var(--text-muted)]">
          {Math.round(t.k * 100)}%
        </span>
        <button
          onClick={() => zoomBy(1.2)}
          className="flex h-[26px] w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--border-soft)]"
          title="Zoom in"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <line x1="12" y1="5" x2="12" y2="19" />
          </svg>
        </button>
        <div className="mx-[3px] h-[18px] w-px bg-[var(--border)]" />
        <button
          onClick={fit}
          className="flex h-[26px] items-center rounded-md px-[9px] text-[11.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--border-soft)]"
          title="Fit to screen"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
