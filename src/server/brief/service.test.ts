import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoOrders } from "@/test/fixtures";
import { BriefModelError, type BriefModel } from "./gemini";
import { createBriefService } from "./service";

const TODAY = "2026-10-14";
const orders = demoOrders(TODAY);

const aiResponse = JSON.stringify({
  summary: "Overdue work and four same-day deliveries need attention first.",
  recommendations: [
    {
      priority: "critical",
      title: "Unblock Copperline Fitness",
      explanation: "PF-10491 is overdue and on hold; get the customer's decision this morning.",
      orderNumbers: ["PF-10491"],
    },
    {
      priority: "high",
      title: "Ship today's packed orders",
      explanation: "PF-10492 is packed and due today.",
      orderNumbers: ["PF-10492"],
    },
  ],
});

function fakeModel(behaviour: () => Promise<string | undefined>): BriefModel & { calls: number } {
  const model = {
    name: "gemini-test",
    calls: 0,
    generate: vi.fn(async () => {
      model.calls += 1;
      return behaviour();
    }),
  };
  return model;
}

describe("brief service", () => {
  let clock: number;
  let logError: ReturnType<typeof vi.fn<(message: string, detail?: unknown) => void>>;
  const now = () => new Date(clock);

  beforeEach(() => {
    clock = Date.parse("2026-10-14T08:00:00Z");
    logError = vi.fn<(message: string, detail?: unknown) => void>();
  });

  const serviceWith = (model: BriefModel | null) => createBriefService({ model, now, logError });

  it("returns a validated, AI-labelled brief", async () => {
    const brief = await serviceWith(fakeModel(async () => aiResponse)).getBrief(orders, TODAY);
    expect(brief).toMatchObject({
      source: "ai",
      model: "gemini-test",
      today: TODAY,
      summary: "Overdue work and four same-day deliveries need attention first.",
      facts: { open: 12, overdue: 3, dueToday: 4, critical: 3, urgent: 4 },
    });
    expect(brief.fallback).toBeUndefined();
    expect(brief.recommendations.map((r) => r.orderNumbers)).toEqual([["PF-10491"], ["PF-10492"]]);
  });

  it("falls back to rules without calling anything when no API key is configured", async () => {
    const brief = await serviceWith(null).getBrief(orders, TODAY);
    expect(brief).toMatchObject({
      source: "rules",
      fallback: { reason: "not_configured", message: "AI brief is off because no Gemini API key is configured." },
    });
    expect(brief.recommendations[0].title).toBe("Recover 3 overdue orders");
    expect(logError).not.toHaveBeenCalled();
  });

  it.each([
    ["rate limits", new BriefModelError("rate_limited", "429"), "rate_limited"],
    ["a rejected API key", new BriefModelError("rejected_key", "400"), "rejected_key"],
    ["timeouts", new BriefModelError("timeout", "timeout"), "timeout"],
    ["API failures", new BriefModelError("api_error", "500"), "api_error"],
    ["unexpected exceptions", new TypeError("socket hang up"), "api_error"],
  ])("falls back to rules on %s", async (_label, error, reason) => {
    const brief = await serviceWith(fakeModel(async () => Promise.reject(error))).getBrief(orders, TODAY);
    expect(brief).toMatchObject({ source: "rules", fallback: { reason } });
    expect(logError).toHaveBeenCalledOnce();
  });

  it.each([
    ["invalid JSON", "not json"],
    ["a schema mismatch", JSON.stringify({ summary: "x", recommendations: [{ priority: "urgent" }] })],
    [
      "a hallucinated order reference",
      JSON.stringify({
        summary: "x",
        recommendations: [{ priority: "high", title: "t", explanation: "e", orderNumbers: ["PF-12345"] }],
      }),
    ],
    ["an empty (blocked) response", undefined],
  ])("discards %s and falls back to rules", async (_label, text) => {
    const brief = await serviceWith(fakeModel(async () => text)).getBrief(orders, TODAY);
    expect(brief).toMatchObject({ source: "rules", fallback: { reason: "invalid_response" } });
    expect(brief.recommendations.length).toBeGreaterThan(0);
    expect(logError).toHaveBeenCalledOnce();
  });

  it("does not call the model when there are no open orders", async () => {
    const model = fakeModel(async () => aiResponse);
    const brief = await serviceWith(model).getBrief(orders.filter((o) => o.status === "COMPLETED"), TODAY);
    expect(brief).toMatchObject({ source: "rules", summary: "All orders are complete. The production queue is clear." });
    expect(brief.fallback).toBeUndefined();
    expect(model.calls).toBe(0);
  });

  describe("caching and refresh", () => {
    it("reuses a generated brief within its TTL and regenerates after it", async () => {
      const model = fakeModel(async () => aiResponse);
      const service = serviceWith(model);
      await service.getBrief(orders, TODAY);
      clock += 9 * 60_000;
      await service.getBrief(orders, TODAY);
      expect(model.calls).toBe(1);
      clock += 2 * 60_000;
      await service.getBrief(orders, TODAY);
      expect(model.calls).toBe(2);
    });

    it("throttles forced refreshes, then allows them", async () => {
      const model = fakeModel(async () => aiResponse);
      const service = serviceWith(model);
      const first = await service.getBrief(orders, TODAY);
      clock += 5_000;
      expect(await service.getBrief(orders, TODAY, { force: true })).toBe(first);
      clock += 15_000;
      await service.getBrief(orders, TODAY, { force: true });
      expect(model.calls).toBe(2);
    });

    it("shares one in-flight request between concurrent callers", async () => {
      const model = fakeModel(() => new Promise((resolve) => setTimeout(() => resolve(aiResponse), 10)));
      const service = serviceWith(model);
      const [a, b] = await Promise.all([service.getBrief(orders, TODAY), service.getBrief(orders, TODAY)]);
      expect(a).toBe(b);
      expect(model.calls).toBe(1);
    });

    it("retries a failed AI call after a short back-off, not the full TTL", async () => {
      let fail = true;
      const model = fakeModel(async () => (fail ? Promise.reject(new BriefModelError("rate_limited", "429")) : aiResponse));
      const service = serviceWith(model);
      expect((await service.getBrief(orders, TODAY)).source).toBe("rules");
      fail = false;
      clock += 30_000;
      expect((await service.getBrief(orders, TODAY)).source).toBe("rules"); // still backing off
      clock += 31_000;
      expect((await service.getBrief(orders, TODAY)).source).toBe("ai");
    });

    it("regenerates on a new shop day", async () => {
      const model = fakeModel(async () => aiResponse);
      const service = serviceWith(model);
      await service.getBrief(orders, TODAY);
      await service.getBrief(orders, "2026-10-15");
      expect(model.calls).toBe(2);
    });
  });
});
