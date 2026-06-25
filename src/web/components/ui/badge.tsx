import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const badge = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)]",
        info: "border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent)]",
        success: "border-[var(--ok-border)] bg-[var(--ok-bg)] text-[var(--ok)]",
        warning: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--warn)]",
        danger: "border-[var(--err-border)] bg-[var(--err-bg)] text-[var(--err-text)]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
