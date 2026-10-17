"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import {
  METHOD_LABELS,
  ORDER_STATUSES,
  PRINT_METHODS,
  PRODUCTION_STAGES,
  STAGE_LABELS,
  STATUS_LABELS,
  type Order,
} from "@/lib/orders";
import {
  MAX_QUANTITY,
  orderInputFromFormData,
  validateOrderInput,
  type FieldErrors,
  type OrderField,
} from "@/lib/order-validation";
import { createOrderAction, updateOrderAction, type OrderActionState } from "@/server/orders/actions";

const IDLE: OrderActionState = { status: "idle" };

const inputClass =
  "block h-9 w-full rounded-md border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500";
const okBorder = "border-slate-200 focus:border-accent-500 focus:ring-accent-500/20";
const errorBorder = "border-red-300 focus:border-red-500 focus:ring-red-500/20";

interface FieldProps {
  name: OrderField;
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string; className: string }) => ReactNode;
}

function Field({ name, label, error, hint, children }: FieldProps) {
  const id = `order-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1.5">
        {children({
          id,
          "aria-invalid": Boolean(error),
          "aria-describedby": describedBy,
          className: `${inputClass} ${error ? errorBorder : okBorder}`,
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Checkbox({
  name,
  label,
  description,
  defaultChecked,
  error,
  disabled,
}: {
  name: OrderField;
  label: string;
  description: string;
  defaultChecked: boolean;
  error?: string;
  disabled: boolean;
}) {
  const id = `order-${name}`;
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-description${error ? ` ${id}-error` : ""}`}
          className="mt-0.5 size-4 rounded border-slate-300 accent-accent-600"
        />
        <div className="text-sm">
          <label htmlFor={id} className="font-medium text-slate-800">
            {label}
          </label>
          <p id={`${id}-description`} className="text-xs text-slate-500">
            {description}
          </p>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 pl-7 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

interface OrderFormProps {
  /** Omit to create a new order. */
  order?: Order;
  today: string;
  onSaved: (order: Order, message: string) => void;
  onCancel: () => void;
  onPendingChange?: (pending: boolean) => void;
  /** Extra actions rendered above the form, e.g. workflow shortcuts. */
  children?: ReactNode;
}

export function OrderForm({ order, today, onSaved, onCancel, onPendingChange, children }: OrderFormProps) {
  const mode = order ? "update" : "create";
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const [state, dispatch, pending] = useActionState(
    async (previous: OrderActionState, formData: FormData) => {
      onPendingChange?.(true);
      try {
        const next = order
          ? await updateOrderAction(order.id, previous, formData)
          : await createOrderAction(previous, formData);
        if (next.status === "success") onSaved(next.order, next.message);
        return next;
      } catch {
        // Network failure or an unexpected server error.
        return {
          status: "error",
          code: "unavailable",
          message: "The server couldn't be reached. Check your connection and try again.",
        } satisfies OrderActionState;
      } finally {
        onPendingChange?.(false);
      }
    },
    IDLE,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Same rules as the server, for instant feedback. The server re-validates.
    const check = validateOrderInput(orderInputFromFormData(formData), { mode, today });
    if (!check.ok) {
      setClientErrors(check.fieldErrors);
      const firstInvalid = Object.keys(check.fieldErrors)[0];
      document.getElementById(`order-${firstInvalid}`)?.focus();
      return;
    }
    setClientErrors({});
    startTransition(() => dispatch(formData));
  }

  const serverErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const errors: FieldErrors = Object.keys(clientErrors).length > 0 ? clientErrors : serverErrors;
  const bannerMessage =
    Object.keys(clientErrors).length > 0
      ? "Please fix the highlighted fields."
      : state.status === "error"
        ? state.message
        : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col">
      <div className="flex-1 space-y-5 px-5 py-5 sm:px-6">
        {bannerMessage && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>{bannerMessage}</p>
          </div>
        )}

        {children}

        <fieldset disabled={pending} className="space-y-4">
          <Field name="customer" label="Customer" error={errors.customer}>
            {(props) => (
              <input
                {...props}
                name="customer"
                defaultValue={order?.customer}
                autoComplete="organization"
                placeholder="e.g. Harbor Lane Coffee"
                autoFocus
              />
            )}
          </Field>

          <Field name="product" label="Product" error={errors.product}>
            {(props) => (
              <input
                {...props}
                name="product"
                defaultValue={order?.product}
                placeholder="e.g. Gildan 5000 tees, 2-colour front"
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="method" label="Print method" error={errors.method}>
              {(props) => (
                <select {...props} name="method" defaultValue={order?.method ?? ""}>
                  <option value="" disabled>
                    Choose a method
                  </option>
                  {PRINT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field name="quantity" label="Quantity" error={errors.quantity}>
              {(props) => (
                <input
                  {...props}
                  name="quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_QUANTITY}
                  step={1}
                  defaultValue={order?.quantity}
                  placeholder="Units"
                />
              )}
            </Field>
          </div>

          <Field
            name="dueDate"
            label="Due date"
            error={errors.dueDate}
            hint={mode === "create" ? "Today or later." : undefined}
          >
            {(props) => (
              <input
                {...props}
                name="dueDate"
                type="date"
                min={mode === "create" ? today : undefined}
                defaultValue={order?.dueDate ?? ""}
              />
            )}
          </Field>

          {order && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field name="status" label="Status" error={errors.status}>
                {(props) => (
                  <select {...props} name="status" defaultValue={order.status}>
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field name="stage" label="Production stage" error={errors.stage}>
                {(props) => (
                  <select {...props} name="stage" defaultValue={order.stage}>
                    {PRODUCTION_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5">
            <Checkbox
              name="artworkApproved"
              label="Artwork approved"
              description="The customer has signed off the proof. Required before production."
              defaultChecked={order?.artworkApproved ?? false}
              error={errors.artworkApproved}
              disabled={pending}
            />
            <Checkbox
              name="rush"
              label="Rush order"
              description="Customer paid for expedited turnaround. Raises its priority."
              defaultChecked={order?.rush ?? false}
              error={errors.rush}
              disabled={pending}
            />
          </div>
        </fieldset>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-w-28 items-center justify-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-70"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {pending ? "Saving…" : order ? "Save changes" : "Create order"}
        </button>
      </div>
    </form>
  );
}
