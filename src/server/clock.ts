import { todayInTimeZone } from "@/lib/orders";

const FALLBACK_TIME_ZONE = "UTC";

/** The shop's IANA time zone from SHOP_TIME_ZONE, falling back to UTC if unset or invalid. */
export function shopTimeZone(): string {
  const configured = process.env.SHOP_TIME_ZONE?.trim();
  if (!configured) return FALLBACK_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configured });
    return configured;
  } catch {
    console.warn(`[clock] Invalid SHOP_TIME_ZONE "${configured}", using ${FALLBACK_TIME_ZONE}.`);
    return FALLBACK_TIME_ZONE;
  }
}

/** Today's date (YYYY-MM-DD) where the shop is. Call only at request time. */
export function shopToday(): string {
  return todayInTimeZone(shopTimeZone());
}
