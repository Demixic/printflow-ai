"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { CalendarClock, CircleCheck, ClipboardList, Eye, Inbox, Plus, SearchX, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { buildBriefInput, fingerprintBriefInput } from "@/lib/brief/input";
import type { BriefResult } from "@/lib/brief/types";
import {
  DEFAULT_FILTERS,
  getMetrics,
  matchesFilters,
  sortByRecent,
  type Order,
  type OrderFilters,
} from "@/lib/orders";
import { getPriorityQueue } from "@/lib/priority";
import { MetricCard, type MetricTone } from "./MetricCard";
import { OperationsBriefPanel, OperationsBriefSkeleton } from "./OperationsBrief";
import { OrderEditor } from "./OrderEditor";
import { OrderFiltersBar } from "./OrderFiltersBar";
import { OrdersTable } from "./OrdersTable";
import { PriorityPanel } from "./PriorityPanel";

interface DashboardProps {
  /** Orders loaded from the database. */
  orders: Order[];
  /** Shop-local calendar date, YYYY-MM-DD. */
  today: string;
  /** Shop IANA time zone, for displaying times consistently on server and client. */
  timeZone: string;
  /** Operations brief, streamed from the server after the orders. */
  briefPromise: Promise<BriefResult>;
  /** False for the read-only demo: editing controls are not shown. */
  canEdit: boolean;
}

type EditorState = { mode: "create" } | { mode: "edit"; order: Order } | null;

function sameFilters(a: OrderFilters, b: OrderFilters): boolean {
  return a.query === b.query && a.status === b.status && a.due === b.due;
}

function scrollToOrders() {
  document.getElementById("orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Dashboard({ orders, today, timeZone, briefPromise, canEdit }: DashboardProps) {
  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_FILTERS);
  const [editor, setEditor] = useState<EditorState>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const metrics = useMemo(() => getMetrics(orders, today), [orders, today]);
  const priorityQueue = useMemo(() => getPriorityQueue(orders, today), [orders, today]);
  const recentOrders = useMemo(() => sortByRecent(orders), [orders]);
  const briefFingerprint = useMemo(() => fingerprintBriefInput(buildBriefInput(orders, today)), [orders, today]);
  const visibleOrders = recentOrders.filter((order) => matchesFilters(order, filters, today));
  const hasActiveFilters = !sameFilters(filters, DEFAULT_FILTERS);

  const applyPreset = (preset: OrderFilters) => {
    setFilters(preset);
    scrollToOrders();
  };

  const dismissToast = useCallback(() => setToast(null), []);

  function handleSaved(order: Order, message: string) {
    setEditor(null);
    setHighlightedId(order.id);
    setToast({
      id: Date.now(),
      message,
      action: {
        label: "Show",
        onClick: () => applyPreset({ ...DEFAULT_FILTERS, query: order.orderNumber }),
      },
    });
  }

  const openEditor = (order: Order) => setEditor({ mode: "edit", order });
  const openCreate = () => setEditor({ mode: "create" });

  const metricCards: {
    label: string;
    value: number;
    detail: string;
    icon: typeof ClipboardList;
    tone: MetricTone;
    preset: OrderFilters;
  }[] = [
    {
      label: "Total orders",
      value: metrics.total,
      detail: `${metrics.open} open in production pipeline`,
      icon: ClipboardList,
      tone: "accent",
      preset: DEFAULT_FILTERS,
    },
    {
      label: "Overdue orders",
      value: metrics.overdue,
      detail: metrics.overdue > 0 ? "Past due date and not yet delivered" : "Nothing past due",
      icon: TriangleAlert,
      tone: "red",
      preset: { ...DEFAULT_FILTERS, due: "overdue" },
    },
    {
      label: "Jobs due today",
      value: metrics.dueToday,
      detail: `${metrics.dueTodayOpen} still to finish before end of day`,
      icon: CalendarClock,
      tone: "amber",
      preset: { ...DEFAULT_FILTERS, due: "today" },
    },
    {
      label: "Completed orders",
      value: metrics.completed,
      detail: `${Math.round((metrics.completed / Math.max(metrics.total, 1)) * 100)}% of all orders delivered`,
      icon: CircleCheck,
      tone: "green",
      preset: { ...DEFAULT_FILTERS, status: "completed" },
    },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      <section id="overview" aria-label="Key metrics" className="scroll-mt-24">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {metricCards.map(({ preset, label, ...card }) => (
            <MetricCard
              key={label}
              label={label}
              {...card}
              active={hasActiveFilters && sameFilters(filters, preset)}
              onSelect={() => applyPreset(preset)}
            />
          ))}
        </div>
      </section>

      <div id="brief" className="scroll-mt-24">
        <Suspense fallback={<OperationsBriefSkeleton />}>
          <OperationsBriefPanel
            briefPromise={briefPromise}
            currentFingerprint={briefFingerprint}
            today={today}
            timeZone={timeZone}
            onSelectOrder={(orderNumber) => applyPreset({ ...DEFAULT_FILTERS, query: orderNumber })}
          />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <section
          id="orders"
          aria-labelledby="orders-heading"
          className="min-w-0 scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div className="space-y-4 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="orders-heading" className="text-sm font-semibold text-slate-900">
                  Recent orders
                </h2>
                <p className="mt-1 text-xs text-slate-500" aria-live="polite">
                  Showing {visibleOrders.length} of {orders.length} orders, newest first
                </p>
              </div>
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="text-xs font-medium text-accent-600 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent-500"
                  >
                    Clear filters
                  </button>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                  >
                    <Plus className="size-4" aria-hidden />
                    New order
                  </button>
                ) : (
                  <Badge tone="slate">
                    <Eye className="size-3" aria-hidden />
                    Read-only
                  </Badge>
                )}
              </div>
            </div>
            <OrderFiltersBar filters={filters} onChange={setFilters} />
          </div>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent-50 text-accent-600">
                <Inbox className="size-5" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-900">No orders yet</p>
              <p className="mt-1 text-xs text-slate-500">
                {canEdit ? (
                  <>
                    Create your first order, or run <code className="font-mono">npm run db:seed</code> to load demo
                    data.
                  </>
                ) : (
                  "Orders will appear here once an editor adds them."
                )}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
                >
                  <Plus className="size-3.5" aria-hidden />
                  New order
                </button>
              )}
            </div>
          ) : visibleOrders.length > 0 ? (
            <OrdersTable
              orders={visibleOrders}
              today={today}
              onEdit={canEdit ? openEditor : undefined}
              highlightedId={highlightedId}
            />
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <SearchX className="size-5" aria-hidden />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-900">No orders match these filters</p>
              <p className="mt-1 text-xs text-slate-500">
                Try a different search term or widen the status and due-date filters.
              </p>
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <PriorityPanel
          items={priorityQueue}
          onSelectOrder={(orderNumber) => applyPreset({ ...DEFAULT_FILTERS, query: orderNumber })}
        />
      </div>

      {canEdit && editor && (
        <OrderEditor
          // Remount per order so the form's default values match the record being edited.
          key={editor.mode === "edit" ? editor.order.id : "new"}
          order={editor.mode === "edit" ? editor.order : undefined}
          today={today}
          onClose={() => setEditor(null)}
          onSaved={handleSaved}
        />
      )}

      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
