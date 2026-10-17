import { z } from "zod";
import {
  ORDER_STATUSES,
  PRINT_METHODS,
  PRODUCTION_STAGES,
  daysUntil,
  isIsoDate,
  type OrderStatus,
  type PrintMethod,
  type ProductionStage,
} from "./orders";

export const MAX_QUANTITY = 100_000;

/** Validated, normalised fields for creating or editing an order. */
export interface OrderInput {
  customer: string;
  product: string;
  method: PrintMethod;
  quantity: number;
  dueDate: string;
  status: OrderStatus;
  stage: ProductionStage;
  rush: boolean;
  artworkApproved: boolean;
}

export type OrderField = keyof OrderInput;
export type FieldErrors = Partial<Record<OrderField, string>>;

export type ValidationResult =
  | { ok: true; data: OrderInput }
  | { ok: false; fieldErrors: FieldErrors };

const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .min(2, `${label} must be at least 2 characters.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const orderSchema = z
  .object({
    customer: requiredText("Customer", 120),
    product: requiredText("Product", 200),
    method: z.enum(PRINT_METHODS, { error: "Choose a print method." }),
    quantity: z.coerce
      .number({ error: "Enter a quantity." })
      .int("Quantity must be a whole number.")
      .min(1, "Quantity must be at least 1.")
      .max(MAX_QUANTITY, `Quantity can't exceed ${MAX_QUANTITY.toLocaleString("en-US")}.`),
    dueDate: z
      .string({ error: "Due date is required." })
      .refine(isIsoDate, "Enter a valid due date."),
    status: z.enum(ORDER_STATUSES, { error: "Choose a status." }).default("ACTIVE"),
    stage: z.enum(PRODUCTION_STAGES, { error: "Choose a production stage." }).default("ARTWORK"),
    rush: z.boolean().default(false),
    artworkApproved: z.boolean().default(false),
  })
  .superRefine((order, ctx) => {
    if (!order.artworkApproved && (order.stage !== "ARTWORK" || order.status === "COMPLETED")) {
      ctx.addIssue({
        code: "custom",
        path: ["artworkApproved"],
        message: "Artwork must be approved before an order moves past the artwork stage.",
      });
    }
  })
  // A completed order has left the floor; keep its stage consistent.
  .transform((order) =>
    order.status === "COMPLETED" ? { ...order, stage: "READY_TO_SHIP" as const } : order,
  );

export interface ValidateOptions {
  mode: "create" | "update";
  /** Shop-local calendar date, YYYY-MM-DD. */
  today: string;
}

/**
 * Validate untrusted order input. New orders may not be due in the past;
 * existing orders may (that is what "overdue" means).
 */
export function validateOrderInput(raw: unknown, { mode, today }: ValidateOptions): ValidationResult {
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as OrderField | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { ok: false, fieldErrors };
  }

  if (mode === "create" && daysUntil(parsed.data.dueDate, today) < 0) {
    return { ok: false, fieldErrors: { dueDate: "Due date can't be in the past." } };
  }

  return { ok: true, data: parsed.data };
}

/** Convert submitted form fields to the plain object the schema expects. */
export function orderInputFromFormData(formData: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const optional = (name: string) => text(name) || undefined;
  return {
    customer: text("customer"),
    product: text("product"),
    method: optional("method"),
    quantity: optional("quantity"),
    dueDate: text("dueDate"),
    status: optional("status"),
    stage: optional("stage"),
    // Unchecked checkboxes are absent from FormData.
    rush: formData.get("rush") === "on",
    artworkApproved: formData.get("artworkApproved") === "on",
  };
}
