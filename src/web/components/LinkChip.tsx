import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { useNavigate, type NavTarget } from "../lib/nav";

export interface LinkChipProps {
  target: NavTarget;
  label: string;
  exists: boolean;
  icon?: ReactNode;
  className?: string;
}

export function LinkChip({ target, label, exists, icon, className }: LinkChipProps) {
  const navigate = useNavigate();

  if (!exists) {
    return (
      <span
        title="링크 대상을 찾을 수 없습니다 (broken link)"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-faint)] line-through cursor-not-allowed",
          className,
        )}
      >
        {icon}
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate(target)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--accent)] transition-colors hover:opacity-80",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
