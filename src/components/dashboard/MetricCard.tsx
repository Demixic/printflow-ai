import type { LucideIcon } from "lucide-react";

export type MetricTone = "accent" | "red" | "amber" | "green";

const ICON_TONES: Record<MetricTone, string> = {
  accent: "bg-accent-50 text-accent-600",
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-600",
  green: "bg-emerald-50 text-emerald-600",
};

interface MetricCardProps {
  label: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  tone: MetricTone;
  active: boolean;
  onSelect: () => void;
}

export function MetricCard({ label, value, detail, icon: Icon, tone, active, onSelect }: MetricCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`group flex w-full flex-col rounded-xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 sm:p-5 ${
        active ? "border-accent-500 ring-1 ring-accent-500" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${ICON_TONES[tone]}`}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
      {active && (
        <p className="mt-2 text-xs font-medium text-accent-600">Filtering the orders table</p>
      )}
    </button>
  );
}
