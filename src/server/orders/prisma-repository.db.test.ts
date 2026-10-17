/**
 * Integration tests against a real PostgreSQL database.
 *
 * Skipped unless TEST_DATABASE_URL is set. Point it at a disposable database
 * (the tests delete every row in "orders") with migrations applied:
 *
 *   DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://… npm run test:db
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { buildDemoOrders } from "@/lib/demo-orders";
import { getMetrics, parseOrderNumber } from "@/lib/orders";
import { getPriorityQueue } from "@/lib/priority";
import { createPrismaOrderRepository } from "./prisma-repository";
import { RepositoryError } from "./repository";
import { createOrderService } from "./service";

const url = process.env.TEST_DATABASE_URL;
const TODAY = "2026-10-14";

describe.skipIf(!url)("PostgreSQL order repository", () => {
  let prisma: PrismaClient;
  let service: ReturnType<typeof createOrderService>;

  beforeAll(() => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    service = createOrderService({
      repository: createPrismaOrderRepository(prisma),
      today: () => TODAY,
      logError: () => {},
    });
  });

  beforeEach(async () => {
    await prisma.order.deleteMany();
    await prisma.orderNumberCounter.deleteMany();
    await prisma.order.createMany({
      data: buildDemoOrders(TODAY).map(({ dueDate, ...o }) => ({ ...o, dueDate: new Date(`${dueDate}T00:00:00Z`) })),
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("lists seeded orders newest first with calendar due dates", async () => {
    const orders = await service.listOrders();
    expect(orders).toHaveLength(18);
    expect(orders[0]).toMatchObject({ orderNumber: "PF-10498", dueDate: "2026-10-23" });
    expect(getMetrics(orders, TODAY)).toMatchObject({ total: 18, overdue: 3, dueToday: 4, completed: 6 });
    expect(getPriorityQueue(orders, TODAY)[0].order.orderNumber).toBe("PF-10491");
  });

  it("creates an order with the next sequential number", async () => {
    const result = await service.createOrder({
      customer: "Lumen Labs",
      product: "Beanies, woven patch",
      method: "EMBROIDERY",
      quantity: "120",
      dueDate: "2026-10-30",
      rush: false,
      artworkApproved: true,
    });
    expect(result).toMatchObject({ ok: true, data: { orderNumber: "PF-10499", stage: "ARTWORK" } });
    const row = await prisma.order.findUnique({ where: { orderNumber: "PF-10499" } });
    expect(row?.dueDate.toISOString()).toBe("2026-10-30T00:00:00.000Z");
  });

  it("assigns distinct, consecutive numbers to concurrent creates", async () => {
    const input = {
      customer: "Bluebird Events",
      product: "Table banners",
      method: "LARGE_FORMAT",
      quantity: "3",
      dueDate: "2026-10-20",
      rush: false,
      artworkApproved: false,
    };
    const results = await Promise.all(Array.from({ length: 10 }, () => service.createOrder(input)));
    const sequences = results.map((r) => (r.ok ? parseOrderNumber(r.data.orderNumber) : r.code));
    expect([...sequences].sort()).toEqual(Array.from({ length: 10 }, (_, i) => 10499 + i));
    expect(await prisma.orderNumberCounter.findUnique({ where: { name: "orders" } })).toMatchObject({ value: 10508 });
  });

  it("keeps numbering numeric past PF-99999 and stays ahead of directly inserted rows", async () => {
    const [demo] = buildDemoOrders(TODAY);
    await prisma.order.create({
      data: { ...demo, sequence: 99999, orderNumber: "PF-99999", dueDate: new Date("2026-10-20T00:00:00Z") },
    });
    const result = await service.createOrder({
      customer: "Lumen Labs",
      product: "Lanyards",
      method: "DTF_TRANSFER",
      quantity: "500",
      dueDate: "2026-10-30",
    });
    expect(result).toMatchObject({ ok: true, data: { orderNumber: "PF-100000" } });
    const listed = (await service.listOrders()).map((o) => o.orderNumber);
    expect(listed.indexOf("PF-100000")).toBeLessThan(listed.indexOf("PF-99999"));
  });

  it("updates and advances an existing order", async () => {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: "PF-10497" } });
    const updated = await service.updateOrder(order.id, {
      customer: order.customer,
      product: order.product,
      method: order.method,
      quantity: "1500",
      dueDate: "2026-10-16",
      status: "ACTIVE",
      stage: "PRODUCTION",
      rush: true,
      artworkApproved: true,
    });
    expect(updated).toMatchObject({ ok: true, data: { quantity: 1500 } });

    const advanced = await service.advanceOrder(order.id);
    expect(advanced).toMatchObject({ ok: true, data: { stage: "QUALITY_CHECK" } });
  });

  it("maps a missing record to not_found", async () => {
    const repository = createPrismaOrderRepository(prisma);
    await expect(repository.update("does-not-exist", { quantity: 1 })).rejects.toMatchObject({
      kind: "not_found",
    } satisfies Partial<RepositoryError>);
    expect(await service.advanceOrder("does-not-exist")).toMatchObject({ ok: false, code: "not_found" });
  });

  it("rejects duplicate order numbers at the database", async () => {
    const [demo] = buildDemoOrders(TODAY);
    await expect(
      prisma.order.create({ data: { ...demo, dueDate: new Date("2026-10-20T00:00:00Z") } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it.each([
    ["quantity below 1", { quantity: 0 }],
    ["quantity above 100,000", { quantity: 100_001 }],
    ["blank customer", { customer: "   " }],
    ["production without approved artwork", { stage: "PRODUCTION" as const, artworkApproved: false }],
    ["completed without approved artwork", { status: "COMPLETED" as const, artworkApproved: false }],
    ["completed before the final stage", { status: "COMPLETED" as const, stage: "QUALITY_CHECK" as const }],
  ])("rejects %s with a CHECK constraint", async (_label, data) => {
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: "PF-10497" } });
    const repository = createPrismaOrderRepository(prisma);
    await expect(repository.update(order.id, data)).rejects.toMatchObject({ kind: "constraint_violation" });
  });

  it("rejects an order number that doesn't match its sequence", async () => {
    await expect(
      prisma.order.update({ where: { orderNumber: "PF-10497" }, data: { orderNumber: "PF-1" } }),
    ).rejects.toThrow(/orders_order_number_check/);
  });
});

describe("PostgreSQL connection failures", () => {
  it("reports an unreachable database as unavailable", async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: "postgresql://nobody:nothing@127.0.0.1:1/none",
        connectionTimeoutMillis: 2000,
      }),
    });
    const service = createOrderService({
      repository: createPrismaOrderRepository(prisma),
      today: () => TODAY,
      logError: () => {},
    });
    expect(await service.advanceOrder("any-id")).toMatchObject({ ok: false, code: "unavailable" });
    await prisma.$disconnect();
  });
});
