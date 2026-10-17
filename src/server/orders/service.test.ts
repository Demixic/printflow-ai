import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatOrderNumber, parseOrderNumber, type Order } from "@/lib/orders";
import { RepositoryError, type OrderRepository } from "./repository";
import { createOrderService } from "./service";

const TODAY = "2026-10-14";

/** In-memory stand-in for PostgreSQL with hooks to inject failures. */
function memoryRepository(seed: Order[] = []) {
  const rows = new Map(seed.map((o) => [o.id, o]));
  let nextId = 1;
  const failures: Partial<Record<keyof OrderRepository, RepositoryError[]>> = {};
  const maybeFail = (method: keyof OrderRepository) => {
    const error = failures[method]?.shift();
    if (error) throw error;
  };

  const repository: OrderRepository = {
    async list() {
      maybeFail("list");
      return [...rows.values()];
    },
    async findById(id) {
      maybeFail("findById");
      return rows.get(id) ?? null;
    },
    async create(data) {
      maybeFail("create");
      const now = new Date().toISOString();
      const highest = Math.max(10000, ...[...rows.values()].map((o) => parseOrderNumber(o.orderNumber) ?? 0));
      const orderNumber = formatOrderNumber(highest + 1);
      const order: Order = { ...data, orderNumber, id: `new-${nextId++}`, createdAt: now, updatedAt: now };
      rows.set(order.id, order);
      return order;
    },
    async update(id, data) {
      maybeFail("update");
      const existing = rows.get(id);
      if (!existing) throw new RepositoryError("not_found", "missing");
      const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
      rows.set(id, updated);
      return updated;
    },
  };

  return {
    repository,
    rows,
    failNext(method: keyof OrderRepository, ...errors: RepositoryError[]) {
      failures[method] = errors;
    },
  };
}

const existing: Order = {
  id: "o-1",
  orderNumber: "PF-10498",
  customer: "Harbor Lane Coffee",
  product: "Comfort Colors tees",
  method: "SCREEN_PRINT",
  quantity: 180,
  dueDate: "2026-10-23",
  status: "ACTIVE",
  stage: "PRODUCTION",
  rush: false,
  artworkApproved: true,
  createdAt: "2026-10-13T09:00:00.000Z",
  updatedAt: "2026-10-13T09:00:00.000Z",
};

const newOrder = {
  customer: "Lumen Labs",
  product: "Quarter-zip pullovers",
  method: "EMBROIDERY",
  quantity: "55",
  dueDate: "2026-10-20",
  rush: true,
  artworkApproved: false,
};

describe("order service", () => {
  let db: ReturnType<typeof memoryRepository>;
  let logError: ReturnType<typeof vi.fn<(message: string, error: unknown) => void>>;
  let service: ReturnType<typeof createOrderService>;

  beforeEach(() => {
    db = memoryRepository([existing]);
    logError = vi.fn<(message: string, error: unknown) => void>();
    service = createOrderService({ repository: db.repository, today: () => TODAY, logError });
  });

  describe("createOrder", () => {
    it("validates, assigns the next order number and saves", async () => {
      const result = await service.createOrder(newOrder);
      expect(result).toMatchObject({
        ok: true,
        data: { orderNumber: "PF-10499", quantity: 55, status: "ACTIVE", stage: "ARTWORK", rush: true },
      });
      expect(db.rows.size).toBe(2);
    });

    it("returns field errors and saves nothing when input is invalid", async () => {
      const result = await service.createOrder({ ...newOrder, quantity: "-3", customer: "" });
      expect(result).toMatchObject({ ok: false, code: "validation" });
      expect(!result.ok && Object.keys(result.fieldErrors ?? {})).toEqual(["customer", "quantity"]);
      expect(db.rows.size).toBe(1);
    });

    it("reports a duplicate order number as a conflict", async () => {
      db.failNext("create", new RepositoryError("unique_violation", "taken"));
      expect(await service.createOrder(newOrder)).toMatchObject({ ok: false, code: "conflict" });
    });

    it("reports a database constraint rejection as a validation failure and logs it", async () => {
      db.failNext("create", new RepositoryError("constraint_violation", "orders_quantity_check"));
      const result = await service.createOrder(newOrder);
      expect(result).toEqual({
        ok: false,
        code: "validation",
        message: "The order breaks a data rule and wasn't saved. Check the values and try again.",
      });
      expect(logError).toHaveBeenCalledOnce();
    });

    it("reports database outages without leaking details", async () => {
      db.failNext("create", new RepositoryError("unavailable", "ECONNREFUSED 10.0.0.5:5432"));
      const result = await service.createOrder(newOrder);
      expect(result).toEqual({
        ok: false,
        code: "unavailable",
        message: "We couldn't reach the order database. Please try again in a moment.",
      });
      expect(logError).toHaveBeenCalledOnce();
    });
  });

  describe("updateOrder", () => {
    const edit = { ...newOrder, status: "ACTIVE", stage: "QUALITY_CHECK", artworkApproved: true };

    it("saves valid changes", async () => {
      const result = await service.updateOrder("o-1", edit);
      expect(result).toMatchObject({ ok: true, data: { id: "o-1", orderNumber: "PF-10498", stage: "QUALITY_CHECK" } });
    });

    it("allows keeping a past due date on an existing order", async () => {
      const result = await service.updateOrder("o-1", { ...edit, dueDate: "2026-10-01" });
      expect(result.ok).toBe(true);
    });

    it("returns not_found for a missing order", async () => {
      expect(await service.updateOrder("nope", edit)).toMatchObject({ ok: false, code: "not_found" });
      expect(await service.updateOrder("", edit)).toMatchObject({ ok: false, code: "not_found" });
    });

    it("rejects inconsistent workflow state", async () => {
      const result = await service.updateOrder("o-1", { ...edit, artworkApproved: false });
      expect(result).toMatchObject({ ok: false, code: "validation", fieldErrors: { artworkApproved: expect.any(String) } });
      expect(db.rows.get("o-1")?.stage).toBe("PRODUCTION");
    });
  });

  describe("advanceOrder", () => {
    it("moves the order to the next stage", async () => {
      expect(await service.advanceOrder("o-1")).toMatchObject({ ok: true, data: { stage: "QUALITY_CHECK" } });
    });

    it("completes an order that is ready to ship", async () => {
      db.rows.set("o-1", { ...existing, stage: "READY_TO_SHIP" });
      expect(await service.advanceOrder("o-1")).toMatchObject({ ok: true, data: { status: "COMPLETED" } });
    });

    it("refuses to start production without approved artwork", async () => {
      db.rows.set("o-1", { ...existing, stage: "ARTWORK", artworkApproved: false });
      expect(await service.advanceOrder("o-1")).toMatchObject({
        ok: false,
        code: "invalid_transition",
        message: "Approve the artwork before production starts.",
      });
    });

    it("returns not_found for a missing order", async () => {
      expect(await service.advanceOrder("nope")).toMatchObject({ ok: false, code: "not_found" });
    });
  });

  it("rethrows unexpected (non-storage) errors instead of hiding bugs", async () => {
    vi.spyOn(db.repository, "findById").mockRejectedValueOnce(new TypeError("boom"));
    await expect(service.advanceOrder("o-1")).rejects.toThrow("boom");
  });
});
