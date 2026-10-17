import { describe, expect, it } from "vitest";
import { orderInputFromFormData, validateOrderInput } from "./order-validation";

const TODAY = "2026-10-14";

const valid = {
  customer: "Harbor Lane Coffee",
  product: "Barista caps, flat embroidery",
  method: "EMBROIDERY",
  quantity: "60",
  dueDate: "2026-10-20",
  status: "ACTIVE",
  stage: "ARTWORK",
  rush: false,
  artworkApproved: false,
};

const create = (overrides: Record<string, unknown>) =>
  validateOrderInput({ ...valid, ...overrides }, { mode: "create", today: TODAY });

describe("validateOrderInput", () => {
  it("accepts a valid order and normalises values", () => {
    const result = create({ customer: "  Harbor Lane Coffee  " });
    expect(result).toEqual({
      ok: true,
      data: { ...valid, quantity: 60 },
    });
  });

  it("defaults status and stage for a new order", () => {
    const result = create({ status: undefined, stage: undefined });
    expect(result.ok && [result.data.status, result.data.stage]).toEqual(["ACTIVE", "ARTWORK"]);
  });

  it.each([
    ["customer", { customer: " " }, "Customer is required."],
    ["customer", { customer: "A" }, "Customer must be at least 2 characters."],
    ["customer", { customer: undefined }, "Customer is required."],
    ["product", { product: "x".repeat(201) }, "Product must be 200 characters or fewer."],
    ["method", { method: "OFFSET" }, "Choose a print method."],
    ["quantity", { quantity: undefined }, "Enter a quantity."],
    ["quantity", { quantity: "abc" }, "Enter a quantity."],
    ["quantity", { quantity: "0" }, "Quantity must be at least 1."],
    ["quantity", { quantity: "2.5" }, "Quantity must be a whole number."],
    ["quantity", { quantity: "100001" }, "Quantity can't exceed 100,000."],
    ["dueDate", { dueDate: "2026-02-30" }, "Enter a valid due date."],
    ["dueDate", { dueDate: "14/10/2026" }, "Enter a valid due date."],
    ["status", { status: "CANCELLED" }, "Choose a status."],
    ["stage", { stage: "SHIPPED" }, "Choose a production stage."],
  ])("rejects an invalid %s", (field, overrides, message) => {
    expect(create(overrides)).toEqual({ ok: false, fieldErrors: { [field]: message } });
  });

  it("reports every invalid field at once", () => {
    const result = create({ customer: "", quantity: "0", method: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors).sort()).toEqual(["customer", "method", "quantity"]);
  });

  it("rejects a past due date when creating, but allows it when editing", () => {
    expect(create({ dueDate: "2026-10-13" })).toEqual({
      ok: false,
      fieldErrors: { dueDate: "Due date can't be in the past." },
    });
    expect(create({ dueDate: TODAY }).ok).toBe(true);
    expect(
      validateOrderInput({ ...valid, dueDate: "2026-10-01" }, { mode: "update", today: TODAY }).ok,
    ).toBe(true);
  });

  it("requires approved artwork before production", () => {
    expect(create({ stage: "PRODUCTION" })).toEqual({
      ok: false,
      fieldErrors: {
        artworkApproved: "Artwork must be approved before an order moves past the artwork stage.",
      },
    });
    expect(create({ stage: "PRODUCTION", artworkApproved: true }).ok).toBe(true);
    expect(create({ status: "COMPLETED" }).ok).toBe(false);
  });

  it("moves completed orders to the final stage", () => {
    const result = create({ status: "COMPLETED", stage: "PRODUCTION", artworkApproved: true });
    expect(result.ok && result.data.stage).toBe("READY_TO_SHIP");
  });
});

describe("orderInputFromFormData", () => {
  it("reads text fields and treats checkboxes as booleans", () => {
    const form = new FormData();
    form.set("customer", "Lumen Labs");
    form.set("product", "Quarter-zips");
    form.set("method", "EMBROIDERY");
    form.set("quantity", "55");
    form.set("dueDate", "2026-10-20");
    form.set("rush", "on");

    expect(orderInputFromFormData(form)).toEqual({
      customer: "Lumen Labs",
      product: "Quarter-zips",
      method: "EMBROIDERY",
      quantity: "55",
      dueDate: "2026-10-20",
      status: undefined,
      stage: undefined,
      rush: true,
      artworkApproved: false,
    });
  });
});
