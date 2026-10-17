import type { BriefResult } from "@/lib/brief/types";
import type { Order } from "@/lib/orders";
import { getBriefService } from "./index";

/** Brief for already-loaded orders. Never rejects, so it is safe to stream to the client. */
export async function briefFor(orders: Order[], today: string, force = false): Promise<BriefResult> {
  try {
    return { ok: true, brief: await getBriefService().getBrief(orders, today, { force }) };
  } catch (error) {
    // AI failures already fall back to rules inside the service; this is a programming error.
    console.error("[brief] failed", error);
    return { ok: false, message: "The operations brief couldn't be loaded. Please try again." };
  }
}
