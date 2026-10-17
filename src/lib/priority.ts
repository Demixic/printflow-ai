import {
  daysUntil,
  isOpen,
  isPreProduction,
  workflowStatus,
  type Order,
  type PrintMethod,
} from "./orders";

export type UrgencyLevel = "critical" | "urgent" | "high" | "normal";

export const URGENCY_LEVELS: UrgencyLevel[] = ["critical", "urgent", "high", "normal"];

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  critical: "Critical",
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
};

const URGENCY_RANK: Record<UrgencyLevel, number> = {
  critical: 0,
  urgent: 1,
  high: 2,
  normal: 3,
};

export interface PriorityItem {
  order: Order;
  level: UrgencyLevel;
  explanation: string;
}

export const LARGE_RUN = 250;

const PRODUCTION_LINES: Record<PrintMethod, string> = {
  SCREEN_PRINT: "screen-print press",
  EMBROIDERY: "embroidery machines",
  DTG: "DTG printers",
  DTF_TRANSFER: "DTF press",
  LARGE_FORMAT: "large-format printer",
};

function stageNote(order: Order): string {
  switch (workflowStatus(order)) {
    case "awaiting_artwork":
      return "artwork is still not approved, so nothing can go to press";
    case "ready_for_press":
      return `artwork is approved but the job is not yet scheduled on the ${PRODUCTION_LINES[order.method]}`;
    case "on_hold":
      return "the job is on hold and needs a customer decision";
    case "in_production":
      return `${order.quantity.toLocaleString("en-US")} units are still on the ${PRODUCTION_LINES[order.method]}`;
    case "quality_check":
      return "it is in quality check and needs sign-off before packing";
    case "ready_to_ship":
      return "it is packed and only needs to be dispatched";
    case "completed":
      return "it is complete";
  }
}

export function urgencyFor(order: Order, today: string): UrgencyLevel {
  const days = daysUntil(order.dueDate, today);
  if (days < 0) return "critical";
  if (days === 0) return "urgent";
  if (days === 1 && isPreProduction(order)) return "urgent";
  if (days <= 3 || order.rush) return "high";
  return "normal";
}

export function explainPriority(order: Order, today: string): string {
  const days = daysUntil(order.dueDate, today);
  let timing: string;
  if (days < 0) timing = `Overdue by ${-days} ${-days === 1 ? "day" : "days"}`;
  else if (days === 0) timing = "Due today";
  else if (days === 1) timing = "Due tomorrow";
  else timing = `Due in ${days} days`;

  const extras: string[] = [];
  if (order.rush) extras.push("Rush order — customer paid for expedited turnaround.");
  if (order.quantity >= LARGE_RUN && order.stage !== "READY_TO_SHIP") {
    extras.push("Large run: allow extra press time.");
  }

  return [`${timing} and ${stageNote(order)}.`, ...extras].join(" ");
}

/**
 * Rank open orders for the production floor. Rules, in order:
 * overdue → critical; due today (or tomorrow and not yet in production) → urgent;
 * due within 3 days or flagged rush → high; everything else → normal.
 * Ties are broken by due date, then pre-production stage, then job size.
 */
export function getPriorityQueue(orders: Order[], today: string): PriorityItem[] {
  return orders
    .filter(isOpen)
    .map((order) => ({
      order,
      days: daysUntil(order.dueDate, today),
      level: urgencyFor(order, today),
      explanation: explainPriority(order, today),
    }))
    .sort(
      (a, b) =>
        URGENCY_RANK[a.level] - URGENCY_RANK[b.level] ||
        a.days - b.days ||
        Number(isPreProduction(b.order)) - Number(isPreProduction(a.order)) ||
        b.order.quantity - a.order.quantity,
    )
    .map(({ order, level, explanation }) => ({ order, level, explanation }));
}
