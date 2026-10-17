/**
 * Order domain: types, labels and pure business rules.
 *
 * This module has no database or framework imports so it can run in the
 * browser, on the server and in unit tests. The enum string values mirror the
 * Prisma schema exactly; src/server/orders/repository.ts checks that at
 * compile time.
 */

export const ORDER_STATUSES = ["ACTIVE", "ON_HOLD", "COMPLETED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PRODUCTION_STAGES = ["ARTWORK", "PRODUCTION", "QUALITY_CHECK", "READY_TO_SHIP"] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const PRINT_METHODS = [
  "SCREEN_PRINT",
  "EMBROIDERY",
  "DTG",
  "DTF_TRANSFER",
  "LARGE_FORMAT",
] as const;
export type PrintMethod = (typeof PRINT_METHODS)[number];

export interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  product: string;
  method: PrintMethod;
  quantity: number;
  /** Calendar date, YYYY-MM-DD */
  dueDate: string;
  status: OrderStatus;
  stage: ProductionStage;
  rush: boolean;
  artworkApproved: boolean;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
}

const ORDER_NUMBER = /^PF-([1-9][0-9]{0,8})$/;

/** Display form of an order's numeric sequence, e.g. 10499 → "PF-10499". */
export function formatOrderNumber(sequence: number): string {
  return `PF-${sequence}`;
}

/** Numeric sequence of an order number, or null if it isn't a valid "PF-<n>". */
export function parseOrderNumber(orderNumber: string): number | null {
  const match = ORDER_NUMBER.exec(orderNumber);
  return match ? Number(match[1]) : null;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

export const STAGE_LABELS: Record<ProductionStage, string> = {
  ARTWORK: "Artwork",
  PRODUCTION: "Production",
  QUALITY_CHECK: "Quality check",
  READY_TO_SHIP: "Ready to ship",
};

export const METHOD_LABELS: Record<PrintMethod, string> = {
  SCREEN_PRINT: "Screen print",
  EMBROIDERY: "Embroidery",
  DTG: "DTG",
  DTF_TRANSFER: "DTF transfer",
  LARGE_FORMAT: "Large format",
};

/**
 * The single status shown on badges and used by the status filter. It is
 * derived from lifecycle status, production stage and artwork approval.
 */
export type WorkflowStatus =
  | "awaiting_artwork"
  | "ready_for_press"
  | "on_hold"
  | "in_production"
  | "quality_check"
  | "ready_to_ship"
  | "completed";

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  awaiting_artwork: "Awaiting artwork",
  ready_for_press: "Ready for press",
  on_hold: "On hold",
  in_production: "In production",
  quality_check: "Quality check",
  ready_to_ship: "Ready to ship",
  completed: "Completed",
};

export const WORKFLOW_ORDER: WorkflowStatus[] = [
  "awaiting_artwork",
  "ready_for_press",
  "on_hold",
  "in_production",
  "quality_check",
  "ready_to_ship",
  "completed",
];

type WorkflowFields = Pick<Order, "status" | "stage" | "artworkApproved">;

export function workflowStatus(order: WorkflowFields): WorkflowStatus {
  if (order.status === "COMPLETED") return "completed";
  if (order.status === "ON_HOLD") return "on_hold";
  switch (order.stage) {
    case "ARTWORK":
      return order.artworkApproved ? "ready_for_press" : "awaiting_artwork";
    case "PRODUCTION":
      return "in_production";
    case "QUALITY_CHECK":
      return "quality_check";
    case "READY_TO_SHIP":
      return "ready_to_ship";
  }
}

/** Production cannot start (or resume) until these are resolved. */
export function isPreProduction(order: WorkflowFields): boolean {
  return order.status === "ON_HOLD" || order.stage === "ARTWORK";
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

export type AdvanceResult =
  | { ok: true; status: OrderStatus; stage: ProductionStage; label: string }
  | { ok: false; reason: string };

const NEXT_STAGE: Record<ProductionStage, { stage: ProductionStage; label: string } | null> = {
  ARTWORK: { stage: "PRODUCTION", label: "Start production" },
  PRODUCTION: { stage: "QUALITY_CHECK", label: "Send to quality check" },
  QUALITY_CHECK: { stage: "READY_TO_SHIP", label: "Mark ready to ship" },
  READY_TO_SHIP: null,
};

/** The next step on the production floor for an order, or why it can't move. */
export function nextWorkflowStep(order: WorkflowFields): AdvanceResult {
  if (order.status === "COMPLETED") return { ok: false, reason: "This order is already completed." };
  if (order.status === "ON_HOLD") {
    return { ok: false, reason: "This order is on hold. Set it back to Active before moving it forward." };
  }
  if (order.stage === "ARTWORK" && !order.artworkApproved) {
    return { ok: false, reason: "Approve the artwork before production starts." };
  }
  const next = NEXT_STAGE[order.stage];
  if (!next) return { ok: true, status: "COMPLETED", stage: order.stage, label: "Mark completed" };
  return { ok: true, status: order.status, stage: next.stage, label: next.label };
}

// ---------------------------------------------------------------------------
// Calendar dates
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `today` until `isoDate` (negative when in the past). */
export function daysUntil(isoDate: string, today: string): number {
  return Math.round((toUtcMs(isoDate) - toUtcMs(today)) / MS_PER_DAY);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(toUtcMs(isoDate) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The calendar date (YYYY-MM-DD) in a given IANA time zone. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(toUtcMs(isoDate)));
}

export function formatLongDate(isoDate: string): string {
  return longDateFormatter.format(new Date(toUtcMs(isoDate)));
}

// ---------------------------------------------------------------------------
// Dashboard queries
// ---------------------------------------------------------------------------

export function isOpen(order: Pick<Order, "status">): boolean {
  return order.status !== "COMPLETED";
}

export function isOverdue(order: Order, today: string): boolean {
  return isOpen(order) && daysUntil(order.dueDate, today) < 0;
}

export function isDueToday(order: Order, today: string): boolean {
  return daysUntil(order.dueDate, today) === 0;
}

export function describeDue(order: Order, today: string): string {
  const days = daysUntil(order.dueDate, today);
  if (!isOpen(order)) return "Delivered";
  if (days < 0) return `${-days} ${-days === 1 ? "day" : "days"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `In ${days} days`;
}

export type DueFilter = "all" | "overdue" | "today" | "week";
export type StatusFilter = WorkflowStatus | "all";

export interface OrderFilters {
  query: string;
  status: StatusFilter;
  due: DueFilter;
}

export const DEFAULT_FILTERS: OrderFilters = { query: "", status: "all", due: "all" };

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  all: "Any date",
  overdue: "Overdue",
  today: "Due today",
  week: "Next 7 days",
};

export function matchesFilters(order: Order, filters: OrderFilters, today: string): boolean {
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = [order.orderNumber, order.customer, order.product, METHOD_LABELS[order.method]]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }

  if (filters.status !== "all" && workflowStatus(order) !== filters.status) return false;

  const days = daysUntil(order.dueDate, today);
  switch (filters.due) {
    case "overdue":
      return isOverdue(order, today);
    case "today":
      return days === 0;
    case "week":
      return days >= 0 && days <= 7;
    default:
      return true;
  }
}

export interface DashboardMetrics {
  total: number;
  open: number;
  overdue: number;
  dueToday: number;
  dueTodayOpen: number;
  completed: number;
}

export function getMetrics(orders: Order[], today: string): DashboardMetrics {
  const dueToday = orders.filter((o) => isDueToday(o, today));
  return {
    total: orders.length,
    open: orders.filter(isOpen).length,
    overdue: orders.filter((o) => isOverdue(o, today)).length,
    dueToday: dueToday.length,
    dueTodayOpen: dueToday.filter(isOpen).length,
    completed: orders.filter((o) => o.status === "COMPLETED").length,
  };
}

/** Newest first, matching the "Recent orders" table. */
export function sortByRecent(orders: Order[]): Order[] {
  const sequence = (o: Order) => parseOrderNumber(o.orderNumber) ?? 0;
  return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || sequence(b) - sequence(a));
}
