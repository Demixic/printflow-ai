import { LARGE_RUN } from "@/lib/priority";
import { MAX_RECOMMENDATIONS, MAX_REFERENCES } from "./schema";
import type { BriefInput, BriefOrder, Recommendation, RecommendationPriority } from "./types";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const refs = (orders: BriefOrder[]) => orders.slice(0, MAX_REFERENCES).map((o) => o.orderNumber);
const list = (orders: BriefOrder[]) => {
  const shown = orders.slice(0, 3).map((o) => o.orderNumber);
  return orders.length > 3 ? `${shown.join(", ")} and ${orders.length - 3} more` : shown.join(", ");
};

/**
 * Deterministic recommendations derived only from the priority rules. Used
 * when Gemini is unavailable or its answer fails validation.
 */
export function buildRuleBasedRecommendations(input: BriefInput): Recommendation[] {
  const open = input.orders;
  const recommendations: Recommendation[] = [];
  const add = (priority: RecommendationPriority, title: string, explanation: string, orders: BriefOrder[]) => {
    if (orders.length > 0) recommendations.push({ priority, title, explanation, orderNumbers: refs(orders) });
  };

  const overdue = open.filter((o) => o.dueInDays < 0);
  add(
    "critical",
    `Recover ${plural(overdue.length, "overdue order")}`,
    `${list(overdue)} ${overdue.length === 1 ? "is" : "are"} past due. Agree new dates with the customers and clear blockers first.`,
    overdue,
  );

  const artwork = open.filter((o) => o.status === "awaiting_artwork" && o.dueInDays >= 0 && o.dueInDays <= 3);
  add(
    artwork.some((o) => o.dueInDays <= 1) ? "critical" : "high",
    "Chase artwork approvals",
    `${list(artwork)} can't go to press until the customer approves the proof, and ${artwork.length === 1 ? "it is" : "they are"} due within 3 days.`,
    artwork,
  );

  const onHold = open.filter((o) => o.status === "on_hold" && o.dueInDays >= 0);
  add(
    "high",
    "Resolve orders on hold",
    `${list(onHold)} ${onHold.length === 1 ? "is" : "are"} on hold awaiting a customer decision.`,
    onHold,
  );

  const finishToday = open.filter(
    (o) => o.dueInDays === 0 && (o.status === "quality_check" || o.status === "ready_to_ship"),
  );
  add(
    "high",
    "Finish and dispatch today's orders",
    `${list(finishToday)} ${finishToday.length === 1 ? "is" : "are"} due today and only need${finishToday.length === 1 ? "s" : ""} sign-off or dispatch.`,
    finishToday,
  );

  const printingToday = open.filter((o) => o.dueInDays === 0 && o.status === "in_production");
  add(
    "high",
    "Keep today's print runs on the press",
    `${list(printingToday)} ${printingToday.length === 1 ? "is" : "are"} due today and still printing.`,
    printingToday,
  );

  const heavy = open.filter(
    (o) => o.dueInDays > 0 && o.dueInDays <= 3 && (o.rush || o.quantity >= LARGE_RUN) && o.status !== "ready_to_ship",
  );
  add(
    "medium",
    "Reserve press time for rush and large runs",
    `${list(heavy)} ${heavy.length === 1 ? "is a rush or large job" : "are rush or large jobs"} due in the next 3 days.`,
    heavy,
  );

  if (recommendations.length === 0) {
    recommendations.push({
      priority: "low",
      title: "No urgent action needed",
      explanation:
        input.totals.open > 0
          ? "No open order is overdue, blocked or due within 3 days. Work the queue in priority order."
          : "There are no open orders.",
      orderNumbers: refs(open.slice(0, 3)),
    });
  }

  return recommendations.slice(0, MAX_RECOMMENDATIONS);
}

export function buildRuleBasedSummary(input: BriefInput): string {
  const { open, overdue, dueToday, dueTodayOpen } = input.totals;
  if (open === 0) return "All orders are complete. The production queue is clear.";
  const parts = [
    `${plural(open, "open order")}`,
    `${overdue} overdue`,
    `${dueToday} due today${dueToday > 0 ? ` (${dueTodayOpen} still open)` : ""}`,
  ];
  const top = input.orders[0];
  return `${parts.join(", ")}. Most urgent: ${top.orderNumber} for ${top.customer} — ${top.reason}`;
}
