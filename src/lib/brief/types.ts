import type { WorkflowStatus } from "@/lib/orders";
import type { UrgencyLevel } from "@/lib/priority";

export const RECOMMENDATION_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type RecommendationPriority = (typeof RECOMMENDATION_PRIORITIES)[number];

export interface Recommendation {
  priority: RecommendationPriority;
  title: string;
  explanation: string;
  /** Order numbers (e.g. "PF-10491") this recommendation is about. */
  orderNumbers: string[];
}

/** One open order as summarised for the brief. Only these fields leave the server. */
export interface BriefOrder {
  orderNumber: string;
  /** Customer name, cleaned and truncated. Untrusted text. */
  customer: string;
  method: string;
  quantity: number;
  dueInDays: number;
  status: WorkflowStatus;
  urgency: UrgencyLevel;
  rush: boolean;
  artworkApproved: boolean;
  /** Deterministic explanation from the priority rules. */
  reason: string;
}

/** The factual summary sent to the model. Everything here is computed by our own rules. */
export interface BriefInput {
  today: string;
  totals: {
    total: number;
    open: number;
    overdue: number;
    dueToday: number;
    dueTodayOpen: number;
    completed: number;
  };
  urgencyCounts: Record<UrgencyLevel, number>;
  statusCounts: Partial<Record<WorkflowStatus, number>>;
  /** Highest-priority open orders, most urgent first. */
  orders: BriefOrder[];
  /** Open orders not included in `orders` because of the size limit. */
  omittedOpenOrders: number;
}

export type FallbackReason =
  | "not_configured"
  | "rejected_key"
  | "rate_limited"
  | "timeout"
  | "api_error"
  | "invalid_response";

export interface OperationsBrief {
  source: "ai" | "rules";
  /** Gemini model name when source is "ai". */
  model?: string;
  /** ISO timestamp. */
  generatedAt: string;
  /** Shop-local date the brief was computed for. */
  today: string;
  /** Fingerprint of the input data, used to detect a stale brief. */
  fingerprint: string;
  summary: string;
  recommendations: Recommendation[];
  facts: Pick<BriefInput["totals"], "open" | "overdue" | "dueToday"> & {
    critical: number;
    urgent: number;
  };
  /** Present when the AI brief couldn't be used and rules were used instead. */
  fallback?: { reason: FallbackReason; message: string };
}

/** What the browser receives: the brief, or a generic message. Never prompts, keys or stack traces. */
export type BriefResult = { ok: true; brief: OperationsBrief } | { ok: false; message: string };

export const FALLBACK_MESSAGES: Record<FallbackReason, string> = {
  not_configured: "AI brief is off because no Gemini API key is configured.",
  rejected_key: "Gemini rejected the configured API key.",
  rate_limited: "Gemini's rate limit was reached. Try refreshing in a minute.",
  timeout: "Gemini took too long to respond.",
  api_error: "Gemini couldn't be reached.",
  invalid_response: "Gemini's answer didn't pass validation, so it was discarded.",
};
