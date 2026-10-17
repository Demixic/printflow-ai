import { briefFacts, buildBriefInput, fingerprintBriefInput } from "@/lib/brief/input";
import { buildRuleBasedRecommendations, buildRuleBasedSummary } from "@/lib/brief/rules";
import { parseAiBrief } from "@/lib/brief/schema";
import { FALLBACK_MESSAGES, type BriefInput, type FallbackReason, type OperationsBrief } from "@/lib/brief/types";
import type { Order } from "@/lib/orders";
import { BriefModelError, type BriefModel } from "./gemini";

export interface BriefServiceDeps {
  /** null when no API key is configured. */
  model: BriefModel | null;
  now?: () => Date;
  logError?: (message: string, detail?: unknown) => void;
  /** How long a generated brief is reused before calling the model again. */
  cacheTtlMs?: number;
  /** How long a failed model attempt is reused, so failures don't hammer the API. */
  failureTtlMs?: number;
  /** Forced refreshes inside this window reuse the latest brief (cost / rate-limit guard). */
  minRefreshIntervalMs?: number;
}

interface CacheEntry {
  brief: OperationsBrief;
  createdAt: number;
  ttl: number;
}

export function createBriefService({
  model,
  now = () => new Date(),
  logError = console.error,
  cacheTtlMs = 10 * 60_000,
  failureTtlMs = 60_000,
  minRefreshIntervalMs = 15_000,
}: BriefServiceDeps) {
  let cache: CacheEntry | null = null;
  let inFlight: Promise<OperationsBrief> | null = null;

  function base(input: BriefInput) {
    return {
      generatedAt: now().toISOString(),
      today: input.today,
      fingerprint: fingerprintBriefInput(input),
      facts: briefFacts(input),
    };
  }

  function ruleBased(input: BriefInput, reason?: FallbackReason): OperationsBrief {
    return {
      ...base(input),
      source: "rules",
      summary: buildRuleBasedSummary(input),
      recommendations: buildRuleBasedRecommendations(input),
      ...(reason && { fallback: { reason, message: FALLBACK_MESSAGES[reason] } }),
    };
  }

  async function generate(input: BriefInput, activeModel: BriefModel): Promise<OperationsBrief> {
    let text: string | undefined;
    try {
      text = await activeModel.generate(input);
    } catch (error) {
      const reason = error instanceof BriefModelError ? error.reason : "api_error";
      // Log the classification and status only; never the prompt or the key.
      logError(`[brief] Gemini call failed (${reason})`, error instanceof Error ? error.message : undefined);
      return ruleBased(input, reason);
    }

    const parsed = parseAiBrief(text, input);
    if (!parsed.ok) {
      logError(`[brief] Gemini response rejected (${parsed.failure})`, parsed.detail);
      return ruleBased(input, "invalid_response");
    }

    return {
      ...base(input),
      source: "ai",
      model: activeModel.name,
      summary: parsed.summary,
      recommendations: parsed.recommendations,
    };
  }

  return {
    /**
     * The operations brief for the given orders. Never throws for AI problems:
     * any failure falls back to the deterministic rule-based brief.
     */
    async getBrief(orders: Order[], today: string, { force = false } = {}): Promise<OperationsBrief> {
      const input = buildBriefInput(orders, today);

      // Nothing to reason about, or no AI configured: rules are exact and free.
      if (input.orders.length === 0) return ruleBased(input);
      if (!model) return ruleBased(input, "not_configured");

      const age = cache ? now().getTime() - cache.createdAt : Infinity;
      if (cache && cache.brief.today === today) {
        if (!force && age < cache.ttl) return cache.brief;
        if (force && age < minRefreshIntervalMs) return cache.brief;
      }
      if (inFlight) return inFlight;

      inFlight = generate(input, model)
        .then((brief) => {
          cache = { brief, createdAt: now().getTime(), ttl: brief.source === "ai" ? cacheTtlMs : failureTtlMs };
          return brief;
        })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
  };
}

export type BriefService = ReturnType<typeof createBriefService>;
