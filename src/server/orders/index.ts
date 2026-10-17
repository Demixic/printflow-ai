import { getPrisma } from "@/server/db";
import { shopToday } from "@/server/clock";
import { createPrismaOrderRepository } from "./prisma-repository";
import { createOrderService, type OrderService } from "./service";

let service: OrderService | undefined;

/** The app's order service, wired to PostgreSQL. Created lazily on first use. */
export function getOrderService(): OrderService {
  service ??= createOrderService({
    repository: createPrismaOrderRepository(getPrisma()),
    today: shopToday,
  });
  return service;
}
