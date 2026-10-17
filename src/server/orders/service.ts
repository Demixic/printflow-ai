import { nextWorkflowStep, type Order } from "@/lib/orders";
import { validateOrderInput, type FieldErrors } from "@/lib/order-validation";
import { RepositoryError, type OrderRepository } from "./repository";

export type ServiceErrorCode = "validation" | "not_found" | "invalid_transition" | "conflict" | "unavailable";

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ServiceErrorCode; message: string; fieldErrors?: FieldErrors };

export interface OrderServiceDeps {
  repository: OrderRepository;
  /** Shop-local calendar date, YYYY-MM-DD. */
  today: () => string;
  logError?: (message: string, error: unknown) => void;
}

const fail = (code: ServiceErrorCode, message: string, fieldErrors?: FieldErrors) =>
  ({ ok: false, code, message, ...(fieldErrors && { fieldErrors }) }) as const;

/** Server actions receive ids from the client, so check them at runtime. */
const isId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

const NOT_FOUND = "This order no longer exists. It may have been removed.";
const UNAVAILABLE = "We couldn't reach the order database. Please try again in a moment.";

export function createOrderService({ repository, today, logError = console.error }: OrderServiceDeps) {
  /** Turn storage failures into user-facing results; anything else is a bug and is rethrown. */
  function handleFailure(error: unknown, context: string): ServiceResult<never> {
    if (error instanceof RepositoryError) {
      if (error.kind === "not_found") return fail("not_found", NOT_FOUND);
      if (error.kind === "unique_violation") {
        return fail("conflict", "Another order was saved at the same time. Please try again.");
      }
      if (error.kind === "constraint_violation") {
        // Validation should have caught this; log it, but tell the user plainly.
        logError(`[orders] ${context} rejected by a database constraint`, error.cause ?? error);
        return fail("validation", "The order breaks a data rule and wasn't saved. Check the values and try again.");
      }
      logError(`[orders] ${context} failed`, error.cause ?? error);
      return fail("unavailable", UNAVAILABLE);
    }
    throw error;
  }

  function invalid(fieldErrors: FieldErrors) {
    return fail("validation", "Please fix the highlighted fields.", fieldErrors);
  }

  return {
    /** Errors propagate so the page's error boundary can render them. */
    listOrders(): Promise<Order[]> {
      return repository.list();
    },

    async createOrder(raw: unknown): Promise<ServiceResult<Order>> {
      const input = validateOrderInput(raw, { mode: "create", today: today() });
      if (!input.ok) return invalid(input.fieldErrors);

      try {
        return { ok: true, data: await repository.create(input.data) };
      } catch (error) {
        return handleFailure(error, "createOrder");
      }
    },

    async updateOrder(id: string, raw: unknown): Promise<ServiceResult<Order>> {
      if (!isId(id)) return fail("not_found", NOT_FOUND);
      const input = validateOrderInput(raw, { mode: "update", today: today() });
      if (!input.ok) return invalid(input.fieldErrors);

      try {
        return { ok: true, data: await repository.update(id, input.data) };
      } catch (error) {
        return handleFailure(error, "updateOrder");
      }
    },

    /** Move an order one step forward in the production workflow. */
    async advanceOrder(id: string): Promise<ServiceResult<Order>> {
      if (!isId(id)) return fail("not_found", NOT_FOUND);
      try {
        const order = await repository.findById(id);
        if (!order) return fail("not_found", NOT_FOUND);

        const step = nextWorkflowStep(order);
        if (!step.ok) return fail("invalid_transition", step.reason);

        return { ok: true, data: await repository.update(id, { status: step.status, stage: step.stage }) };
      } catch (error) {
        return handleFailure(error, "advanceOrder");
      }
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
