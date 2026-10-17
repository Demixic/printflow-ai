import { buildDemoOrders } from "@/lib/demo-orders";
import type { Order } from "@/lib/orders";

/** The 18 demo orders as domain objects, dated relative to `today`. */
export function demoOrders(today = "2026-10-14"): Order[] {
  return buildDemoOrders(today).map((record, i) => {
    const order: Order & { sequence?: number } = {
      ...record,
      id: `demo-${i}`,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.createdAt.toISOString(),
    };
    delete order.sequence; // storage detail, not part of the domain Order
    return order;
  });
}
