"use server";

import { refresh } from "next/cache";
import type { Order } from "@/lib/orders";
import { orderInputFromFormData, type FieldErrors } from "@/lib/order-validation";
import { requirePermission } from "@/server/auth/session";
import { getOrderService } from "./index";
import type { ServiceErrorCode, ServiceResult } from "./service";

export type OrderActionState =
  | { status: "idle" }
  | { status: "success"; message: string; order: Order }
  | {
      status: "error";
      code: ServiceErrorCode | "unauthorized" | "forbidden";
      message: string;
      fieldErrors?: FieldErrors;
    };

/**
 * Every write checks the signed session on the server before touching the
 * service. Hiding buttons in the UI is a convenience, not the protection.
 */
async function denyUnlessEditor(): Promise<OrderActionState | null> {
  const auth = await requirePermission("orders:write");
  return auth.ok ? null : { status: "error", code: auth.code, message: auth.message };
}

function toState(result: ServiceResult<Order>, successMessage: (order: Order) => string): OrderActionState {
  if (!result.ok) {
    return { status: "error", code: result.code, message: result.message, fieldErrors: result.fieldErrors };
  }
  // Re-render the dashboard with fresh data from the database.
  refresh();
  return { status: "success", message: successMessage(result.data), order: result.data };
}

export async function createOrderAction(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const denied = await denyUnlessEditor();
  if (denied) return denied;
  const result = await getOrderService().createOrder(orderInputFromFormData(formData));
  return toState(result, (order) => `Order ${order.orderNumber} created.`);
}

export async function updateOrderAction(
  id: string,
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const denied = await denyUnlessEditor();
  if (denied) return denied;
  const result = await getOrderService().updateOrder(id, orderInputFromFormData(formData));
  return toState(result, (order) => `Order ${order.orderNumber} updated.`);
}

export async function advanceOrderAction(id: string): Promise<OrderActionState> {
  const denied = await denyUnlessEditor();
  if (denied) return denied;
  const result = await getOrderService().advanceOrder(id);
  return toState(result, (order) => `Order ${order.orderNumber} moved forward.`);
}
