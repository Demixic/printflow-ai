import type { Order } from "@/lib/orders";
import type { OrderInput } from "@/lib/order-validation";

/** Persistence port used by the order service. */
export interface OrderRepository {
  list(): Promise<Order[]>;
  findById(id: string): Promise<Order | null>;
  /** Saves a new order and allocates the next order number atomically. */
  create(data: OrderInput): Promise<Order>;
  /** Throws RepositoryError("not_found") when the id does not exist. */
  update(id: string, data: Partial<OrderInput>): Promise<Order>;
}

export type RepositoryErrorKind = "not_found" | "unique_violation" | "constraint_violation" | "unavailable";

/** Storage failures translated into something the service can reason about. */
export class RepositoryError extends Error {
  constructor(
    readonly kind: RepositoryErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "RepositoryError";
  }
}
