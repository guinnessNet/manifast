import { cn } from "../lib/cn";

export interface ErrorBannerProps {
  message: string;
  path?: string;
  kind?: "error" | "warning";
  className?: string;
}

export function ErrorBanner({ message, path, kind = "error", className }: ErrorBannerProps) {
  const isWarn = kind === "warning";
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        isWarn
          ? "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn)]"
          : "border-[var(--err-border)] bg-[var(--err-bg)] text-[var(--err-text)]",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden>{isWarn ? "⚠️" : "⛔"}</span>
        <div className="min-w-0">
          {path && <div className="font-mono text-xs opacity-70 break-all">{path}</div>}
          <div className="break-words">{message}</div>
        </div>
      </div>
    </div>
  );
}
