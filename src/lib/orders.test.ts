import { describe, expect, it } from "vitest";
import { formatOrderNumber, parseOrderNumber, sortByRecent, type Order } from "./orders";

describe("order numbers", () => {
  it("formats and parses the numeric sequence", () => {
    expect(formatOrderNumber(10499)).toBe("PF-10499");
    expect(parseOrderNumber("PF-10499")).toBe(10499);
    expect(parseOrderNumber(formatOrderNumber(100000))).toBe(100000);
  });

  it.each(["PF-", "PF-0", "PF-012", "pf-10", "PF-12a", "XX-10", " PF-10", "PF-1234567890"])(
    "rejects %j",
    (value) => {
      expect(parseOrderNumber(value)).toBeNull();
    },
  );

  it("sorts numerically past five digits (PF-99999 before PF-100000 in recency ties)", () => {
    const at = "2026-10-14T09:00:00.000Z";
    const order = (orderNumber: string) => ({ orderNumber, createdAt: at }) as Order;
    // String comparison would put "PF-99999" after "PF-100000".
    expect(sortByRecent([order("PF-99999"), order("PF-100000")]).map((o) => o.orderNumber)).toEqual([
      "PF-100000",
      "PF-99999",
    ]);
  });
});
