import { Prisma, type Order as OrderRow, type PrismaClient } from "@/generated/prisma/client";
import { formatOrderNumber, type Order } from "@/lib/orders";
import type { OrderInput } from "@/lib/order-validation";
import { RepositoryError, type OrderRepository } from "./repository";

// Compile-time guard: the domain enums must stay identical to the Prisma enums.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const enumsInSync: [
  Same<Order["status"], OrderRow["status"]>,
  Same<Order["stage"], OrderRow["stage"]>,
  Same<Order["method"], OrderRow["method"]>,
] = [true, true, true];
void enumsInSync;

/** `@db.Date` columns round-trip as midnight UTC. */
function toDateColumn(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toDomain(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    customer: row.customer,
    product: row.product,
    method: row.method,
    quantity: row.quantity,
    dueDate: row.dueDate.toISOString().slice(0, 10),
    status: row.status,
    stage: row.stage,
    rush: row.rush,
    artworkApproved: row.artworkApproved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRow(data: Partial<OrderInput>) {
  const { dueDate, ...rest } = data;
  return dueDate === undefined ? rest : { ...rest, dueDate: toDateColumn(dueDate) };
}

const COUNTER = "orders";
const FIRST_SEQUENCE_FLOOR = 10000;

/** Postgres SQLSTATE behind a driver-adapter error, e.g. "23514" for a CHECK violation. */
function postgresCode(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const cause = (error.meta?.driverAdapterError as { cause?: { originalCode?: unknown } } | undefined)?.cause;
  return typeof cause?.originalCode === "string" ? cause.originalCode : undefined;
}

function translate(error: unknown): never {
  if (error instanceof RepositoryError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (postgresCode(error) === "23514") {
      throw new RepositoryError("constraint_violation", "A database integrity rule rejected the change.", {
        cause: error,
      });
    }
    if (error.code === "P2025") throw new RepositoryError("not_found", "Order not found.", { cause: error });
    if (error.code === "P2002") {
      throw new RepositoryError("unique_violation", "Order number already exists.", { cause: error });
    }
  }
  throw new RepositoryError("unavailable", "The database request failed.", { cause: error });
}

export function createPrismaOrderRepository(prisma: PrismaClient): OrderRepository {
  return {
    async list() {
      try {
        const rows = await prisma.order.findMany({ orderBy: [{ createdAt: "desc" }, { sequence: "desc" }] });
        return rows.map(toDomain);
      } catch (error) {
        translate(error);
      }
    },

    async findById(id) {
      try {
        const row = await prisma.order.findUnique({ where: { id } });
        return row ? toDomain(row) : null;
      } catch (error) {
        translate(error);
      }
    },

    async create(data) {
      try {
        return await prisma.$transaction(async (tx) => {
          // Atomically take the next number. The upsert row-locks the counter
          // until commit, so concurrent creates are serialised; GREATEST keeps
          // it ahead of rows inserted directly (e.g. by the seed script).
          const [{ value: sequence }] = await tx.$queryRaw<{ value: number }[]>`
            INSERT INTO order_number_counters (name, value)
            VALUES (${COUNTER}, (SELECT GREATEST(${FIRST_SEQUENCE_FLOOR}, COALESCE(MAX(order_seq), 0)) + 1 FROM orders))
            ON CONFLICT (name) DO UPDATE
              SET value = GREATEST(order_number_counters.value, (SELECT COALESCE(MAX(order_seq), 0) FROM orders)) + 1
            RETURNING value`;
          const row = await tx.order.create({
            data: {
              ...data,
              sequence,
              orderNumber: formatOrderNumber(sequence),
              dueDate: toDateColumn(data.dueDate),
            },
          });
          return toDomain(row);
        });
      } catch (error) {
        translate(error);
      }
    },

    async update(id, data) {
      try {
        return toDomain(await prisma.order.update({ where: { id }, data: toRow(data) }));
      } catch (error) {
        translate(error);
      }
    },
  };
}
