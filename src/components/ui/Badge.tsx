import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "accent" | "amber" | "red" | "green" | "sky" | "teal" | "slate";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-50 text-slate-700 ring-slate-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  accent: "bg-accent-50 text-accent-700 ring-accent-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-200/70",
  red: "bg-red-50 text-red-700 ring-red-200/70",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  sky: "bg-sky-50 text-sky-700 ring-sky-200/70",
  teal: "bg-teal-50 text-teal-700 ring-teal-200/70",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  slate: "bg-slate-400",
  accent: "bg-accent-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  green: "bg-emerald-500",
  sky: "bg-sky-500",
  teal: "bg-teal-500",
};

interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}

export function Badge({ tone = "neutral", dot = false, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${DOT_CLASSES[tone]}`} aria-hidden />}
      {children}
    </span>
  );
}
