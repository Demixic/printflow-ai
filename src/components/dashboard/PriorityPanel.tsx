import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { formatDate } from "@/lib/orders";
import { URGENCY_LEVELS, type PriorityItem, type UrgencyLevel } from "@/lib/priority";
import { UrgencyBadge } from "./StatusBadge";

const INITIAL_VISIBLE = 5;

const ACCENT_BAR: Record<UrgencyLevel, string> = {
  critical: "bg-red-500",
  urgent: "bg-amber-500",
  high: "bg-accent-500",
  normal: "bg-slate-300",
};

interface PriorityPanelProps {
  items: PriorityItem[];
  onSelectOrder: (orderNumber: string) => void;
}

export function PriorityPanel({ items, onSelectOrder }: PriorityPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, INITIAL_VISIBLE);
  const counts = items.reduce<Record<UrgencyLevel, number>>(
    (acc, item) => ({ ...acc, [item.level]: acc[item.level] + 1 }),
    { critical: 0, urgent: 0, high: 0, normal: 0 },
  );

  return (
    <section
      id="priority"
      aria-labelledby="priority-heading"
      className="scroll-mt-24 rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 id="priority-heading" className="text-sm font-semibold text-slate-900">
          Production priority
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Open jobs ranked by due date, production stage and rush status.
        </p>
        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {URGENCY_LEVELS.map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${ACCENT_BAR[level]}`} aria-hidden />
              <dt className="capitalize text-slate-500">{level}</dt>
              <dd className="font-medium tabular-nums text-slate-900">{counts[level]}</dd>
            </div>
          ))}
        </dl>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">
          No open jobs — the production queue is clear.
        </p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {visible.map(({ order, level, explanation }, index) => (
            <li key={order.id} className="relative">
              <span className={`absolute inset-y-3 left-0 w-0.5 rounded-r ${ACCENT_BAR[level]}`} aria-hidden />
              <button
                type="button"
                onClick={() => onSelectOrder(order.orderNumber)}
                className="group w-full px-5 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500"
                aria-label={`Priority ${index + 1}: ${order.orderNumber}, ${order.customer}. Show in orders table.`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xs font-medium tabular-nums text-slate-400">{index + 1}</span>
                    <UrgencyBadge level={level} />
                    <span className="truncate font-mono text-xs font-medium text-slate-500">
                      {order.orderNumber}
                    </span>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-slate-500">
                    Due {formatDate(order.dueDate)}
                    <ArrowUpRight
                      className="size-3.5 text-slate-300 transition-colors group-hover:text-accent-600"
                      aria-hidden
                    />
                  </span>
                </div>
                <p className="mt-1.5 truncate text-sm font-medium text-slate-900">{order.customer}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{explanation}</p>
              </button>
            </li>
          ))}
        </ol>
      )}

      {items.length > INITIAL_VISIBLE && (
        <div className="border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="text-xs font-medium text-accent-600 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent-500"
          >
            {expanded ? "Show top 5 only" : `Show all ${items.length} open jobs`}
          </button>
        </div>
      )}
    </section>
  );
}
