/**
 * Seeds the 18 demo orders. Safe to re-run: existing demo orders (matched by
 * order number) are reset to their demo values with dates relative to today.
 * Orders you created yourself are left untouched, and the order-number
 * counter is moved past the demo numbers so new orders never collide.
 *
 *   npm run db:seed
 */
import { buildDemoOrders } from "../src/lib/demo-orders";
import { getPrisma } from "../src/server/db";
import { shopToday } from "../src/server/clock";

async function main() {
  const prisma = getPrisma();
  const today = shopToday();
  const orders = buildDemoOrders(today);

  await prisma.$transaction(
    orders.map(({ dueDate, ...order }) => {
      const data = { ...order, dueDate: new Date(`${dueDate}T00:00:00.000Z`) };
      return prisma.order.upsert({
        where: { orderNumber: order.orderNumber },
        create: data,
        update: data,
      });
    }),
  );

  // Keep the order-number counter ahead of the seeded numbers.
  const highest = Math.max(...orders.map((o) => o.sequence));
  await prisma.$executeRaw`
    INSERT INTO order_number_counters (name, value) VALUES ('orders', ${highest})
    ON CONFLICT (name) DO UPDATE SET value = GREATEST(order_number_counters.value, ${highest})`;

  console.log(`Seeded ${orders.length} demo orders relative to ${today}.`);
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
