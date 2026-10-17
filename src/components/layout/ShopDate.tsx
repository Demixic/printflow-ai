import { connection } from "next/server";
import { CalendarDays } from "lucide-react";
import { formatLongDate } from "@/lib/orders";
import { shopTimeZone, shopToday } from "@/server/clock";

/** Today's date in the shop's time zone. Rendered per request. */
export async function ShopDate() {
  await connection();
  const timeZone = shopTimeZone();
  return (
    <p
      className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 sm:inline-flex"
      title={`Shop time zone: ${timeZone}`}
    >
      <CalendarDays className="size-3.5 text-slate-400" aria-hidden />
      {formatLongDate(shopToday())}
    </p>
  );
}
