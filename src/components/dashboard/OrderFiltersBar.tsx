import { ChevronDown, Search, X } from "lucide-react";
import {
  DUE_FILTER_LABELS,
  WORKFLOW_LABELS,
  WORKFLOW_ORDER,
  type DueFilter,
  type OrderFilters,
  type StatusFilter,
} from "@/lib/orders";

const DUE_OPTIONS: DueFilter[] = ["all", "overdue", "today", "week"];

interface OrderFiltersBarProps {
  filters: OrderFilters;
  onChange: (next: OrderFilters) => void;
}

export function OrderFiltersBar({ filters, onChange }: OrderFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <label htmlFor="order-search" className="sr-only">
          Search orders
        </label>
        <input
          id="order-search"
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Search order #, customer or product"
          autoComplete="off"
          className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.query && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, query: "" })}
            className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Clear search"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative">
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={(event) =>
              onChange({ ...filters, status: event.target.value as StatusFilter })
            }
            className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 sm:w-44"
          >
            <option value="all">All statuses</option>
            {WORKFLOW_ORDER.map((status) => (
              <option key={status} value={status}>
                {WORKFLOW_LABELS[status]}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
        </div>

        <div
          role="group"
          aria-label="Filter by due date"
          className="grid grid-cols-2 rounded-md min-[400px]:grid-cols-4 sm:flex border border-slate-200 bg-slate-50 p-0.5"
        >
          {DUE_OPTIONS.map((option) => {
            const selected = filters.due === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...filters, due: option })}
                className={`h-8 whitespace-nowrap rounded px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-500 ${
                  selected
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {DUE_FILTER_LABELS[option]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
