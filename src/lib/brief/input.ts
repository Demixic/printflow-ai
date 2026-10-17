import {
  METHOD_LABELS,
  daysUntil,
  getMetrics,
  workflowStatus,
  type Order,
  type WorkflowStatus,
} from "@/lib/orders";
import { URGENCY_LEVELS, getPriorityQueue, type UrgencyLevel } from "@/lib/priority";
import type { BriefInput, OperationsBrief } from "./types";

/** Max orders sent to the model; the rest are counted, not listed. */
export const MAX_BRIEF_ORDERS = 20;
const MAX_CUSTOMER_LENGTH = 60;

/**
 * Make customer-entered text safe to embed in a prompt as data: strip control
 * and formatting characters, flatten whitespace, drop characters used to fake
 * structure (`<>{}[]` and backticks) and cap the length. Meaning is kept;
 * instructions inside it are still just data to the model.
 */
export function sanitizeText(value: string, maxLength = MAX_CUSTOMER_LENGTH): string {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/[<>{}[\]`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1)}…` : cleaned;
}

/** Summarise orders into the facts the brief is built from. Pure and deterministic. */
export function buildBriefInput(orders: Order[], today: string): BriefInput {
  const metrics = getMetrics(orders, today);
  const queue = getPriorityQueue(orders, today);

  const urgencyCounts = Object.fromEntries(URGENCY_LEVELS.map((level) => [level, 0])) as Record<
    UrgencyLevel,
    number
  >;
  for (const item of queue) urgencyCounts[item.level] += 1;

  const statusCounts: Partial<Record<WorkflowStatus, number>> = {};
  for (const order of orders) {
    const status = workflowStatus(order);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  return {
    today,
    totals: metrics,
    urgencyCounts,
    statusCounts,
    orders: queue.slice(0, MAX_BRIEF_ORDERS).map(({ order, level, explanation }) => ({
      orderNumber: order.orderNumber,
      customer: sanitizeText(order.customer),
      method: METHOD_LABELS[order.method],
      quantity: order.quantity,
      dueInDays: daysUntil(order.dueDate, today),
      status: workflowStatus(order),
      urgency: level,
      rush: order.rush,
      artworkApproved: order.artworkApproved,
      reason: explanation,
    })),
    omittedOpenOrders: Math.max(0, queue.length - MAX_BRIEF_ORDERS),
  };
}

/** Short stable hash (FNV-1a) of the brief input, so the UI can tell when a brief is stale. */
export function fingerprintBriefInput(input: BriefInput): string {
  const text = JSON.stringify(input);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function briefFacts(input: BriefInput): OperationsBrief["facts"] {
  return {
    open: input.totals.open,
    overdue: input.totals.overdue,
    dueToday: input.totals.dueToday,
    critical: input.urgencyCounts.critical,
    urgent: input.urgencyCounts.urgent,
  };
}
