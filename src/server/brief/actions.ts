"use server";

import { shopToday } from "@/server/clock";
import { getOrderService } from "@/server/orders";
import type { BriefResult } from "@/lib/brief/types";
import { requirePermission } from "@/server/auth/session";
import { briefFor } from "./load";

/** Refresh button: reads current orders and asks for a new brief (throttled server-side). */
export async function refreshBriefAction(): Promise<BriefResult> {
  // Signed-in users only (editor or read-only demo); forced refreshes are also throttled.
  const auth = await requirePermission("brief:refresh");
  if (!auth.ok) return { ok: false, message: auth.message };
  let orders;
  try {
    orders = await getOrderService().listOrders();
  } catch (error) {
    console.error("[brief] refresh could not load orders", error);
    return { ok: false, message: "Orders couldn't be loaded, so the brief wasn't refreshed. Please try again." };
  }
  return briefFor(orders, shopToday(), true);
}
