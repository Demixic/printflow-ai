import { describe, expect, it } from "vitest";
import { buildDemoOrders } from "./demo-orders";
import { getMetrics, matchesFilters, nextWorkflowStep, todayInTimeZone, workflowStatus, type Order } from "./orders";
import { explainPriority, getPriorityQueue, urgencyFor } from "./priority";

const TODAY = "2026-10-14";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: "PF-10001",
    customer: "Lumen Labs",
    product: "Quarter-zip pullovers",
    method: "EMBROIDERY",
    quantity: 50,
    dueDate: "2026-10-24",
    status: "ACTIVE",
    stage: "PRODUCTION",
    rush: false,
    artworkApproved: true,
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}

const demoOrders: Order[] = buildDemoOrders(TODAY).map((o, i) => ({
  ...o,
  id: `demo-${i}`,
  createdAt: o.createdAt.toISOString(),
  updatedAt: o.createdAt.toISOString(),
}));

describe("urgencyFor", () => {
  it.each([
    ["overdue", { dueDate: "2026-10-13" }, "critical"],
    ["due today", { dueDate: TODAY }, "urgent"],
    ["due tomorrow, artwork pending", { dueDate: "2026-10-15", stage: "ARTWORK", artworkApproved: false }, "urgent"],
    ["due tomorrow, on hold", { dueDate: "2026-10-15", status: "ON_HOLD" }, "urgent"],
    ["due tomorrow, already printing", { dueDate: "2026-10-15" }, "high"],
    ["due in 3 days", { dueDate: "2026-10-17" }, "high"],
    ["rush, due in 10 days", { dueDate: "2026-10-24", rush: true }, "high"],
    ["due in 4 days", { dueDate: "2026-10-18" }, "normal"],
  ] as const)("%s → %s", (_label, overrides, level) => {
    expect(urgencyFor(order(overrides), TODAY)).toBe(level);
  });
});

describe("explainPriority", () => {
  it("states timing, stage, rush and job size", () => {
    expect(
      explainPriority(order({ dueDate: "2026-10-13", quantity: 300, rush: true, method: "SCREEN_PRINT" }), TODAY),
    ).toBe(
      "Overdue by 1 day and 300 units are still on the screen-print press. " +
        "Rush order — customer paid for expedited turnaround. Large run: allow extra press time.",
    );
  });

  it("explains approved artwork that has not been scheduled", () => {
    expect(explainPriority(order({ stage: "ARTWORK", dueDate: "2026-10-16" }), TODAY)).toBe(
      "Due in 2 days and artwork is approved but the job is not yet scheduled on the embroidery machines.",
    );
  });
});

describe("getPriorityQueue", () => {
  it("excludes completed orders and ranks by urgency, then due date", () => {
    const queue = getPriorityQueue(
      [
        order({ id: "later", dueDate: "2026-10-20" }),
        order({ id: "done", dueDate: "2026-10-10", status: "COMPLETED" }),
        order({ id: "today", dueDate: TODAY }),
        order({ id: "late", dueDate: "2026-10-12" }),
        order({ id: "later-late", dueDate: "2026-10-13" }),
      ],
      TODAY,
    );
    expect(queue.map((item) => item.order.id)).toEqual(["late", "later-late", "today", "later"]);
  });

  it("breaks ties by pre-production stage, then job size", () => {
    const queue = getPriorityQueue(
      [
        order({ id: "small", quantity: 10 }),
        order({ id: "big", quantity: 500 }),
        order({ id: "artwork", stage: "ARTWORK", artworkApproved: false, quantity: 5 }),
      ],
      TODAY,
    );
    expect(queue.map((item) => item.order.id)).toEqual(["artwork", "big", "small"]);
  });

  it("matches the original dashboard ranking for the seeded demo data", () => {
    const queue = getPriorityQueue(demoOrders, TODAY);
    expect(queue.map((item) => `${item.level}:${item.order.orderNumber}`)).toEqual([
      "critical:PF-10491",
      "critical:PF-10487",
      "critical:PF-10494",
      "urgent:PF-10493",
      "urgent:PF-10495",
      "urgent:PF-10492",
      "urgent:PF-10496",
      "high:PF-10497",
      "high:PF-10490",
      "normal:PF-10489",
      "normal:PF-10484",
      "normal:PF-10498",
    ]);
  });
});

describe("dashboard metrics", () => {
  it("derives totals from the order list", () => {
    expect(getMetrics(demoOrders, TODAY)).toEqual({
      total: 18,
      open: 12,
      overdue: 3,
      dueToday: 4,
      dueTodayOpen: 3,
      completed: 6,
    });
  });

  it("filters by derived workflow status and due window", () => {
    const filters = { query: "", status: "awaiting_artwork", due: "all" } as const;
    expect(demoOrders.filter((o) => matchesFilters(o, filters, TODAY)).map((o) => o.orderNumber)).toEqual([
      "PF-10498",
      "PF-10496",
    ]);
    const overdue = { query: "", status: "all", due: "overdue" } as const;
    expect(demoOrders.filter((o) => matchesFilters(o, overdue, TODAY))).toHaveLength(3);
    const search = { query: "dtf", status: "all", due: "all" } as const;
    expect(demoOrders.filter((o) => matchesFilters(o, search, TODAY))).toHaveLength(2);
  });
});

describe("workflow", () => {
  it("derives the display status", () => {
    expect(workflowStatus(order({ stage: "ARTWORK", artworkApproved: false }))).toBe("awaiting_artwork");
    expect(workflowStatus(order({ stage: "ARTWORK", artworkApproved: true }))).toBe("ready_for_press");
    expect(workflowStatus(order({ status: "ON_HOLD" }))).toBe("on_hold");
    expect(workflowStatus(order({ status: "COMPLETED" }))).toBe("completed");
  });

  it("advances one stage at a time and blocks invalid moves", () => {
    expect(nextWorkflowStep(order({ stage: "PRODUCTION" }))).toMatchObject({ ok: true, stage: "QUALITY_CHECK" });
    expect(nextWorkflowStep(order({ stage: "READY_TO_SHIP" }))).toMatchObject({ ok: true, status: "COMPLETED" });
    expect(nextWorkflowStep(order({ stage: "ARTWORK", artworkApproved: false }))).toMatchObject({ ok: false });
    expect(nextWorkflowStep(order({ status: "ON_HOLD" }))).toMatchObject({ ok: false });
    expect(nextWorkflowStep(order({ status: "COMPLETED" }))).toMatchObject({ ok: false });
  });
});

describe("todayInTimeZone", () => {
  it("uses the shop's calendar date, not the server's", () => {
    const instant = new Date("2026-10-14T20:30:00Z");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-10-14");
    expect(todayInTimeZone("Asia/Kuala_Lumpur", instant)).toBe("2026-10-15");
    expect(todayInTimeZone("America/Los_Angeles", new Date("2026-10-15T03:00:00Z"))).toBe("2026-10-14");
  });
});
