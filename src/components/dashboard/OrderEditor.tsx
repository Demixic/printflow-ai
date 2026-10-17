"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { SlideOver } from "@/components/ui/SlideOver";
import { describeDue, nextWorkflowStep, workflowStatus, type Order } from "@/lib/orders";
import { advanceOrderAction } from "@/server/orders/actions";
import { OrderForm } from "./OrderForm";
import { StatusBadge } from "./StatusBadge";

interface OrderEditorProps {
  /** Omit to create a new order. */
  order?: Order;
  today: string;
  onClose: () => void;
  onSaved: (order: Order, message: string) => void;
}

/** One-click move to the next workflow step, shown above the edit form. */
function WorkflowStep({
  order,
  disabled,
  onSaved,
  onPendingChange,
}: {
  order: Order;
  disabled: boolean;
  onSaved: OrderEditorProps["onSaved"];
  onPendingChange: (pending: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const step = nextWorkflowStep(order);

  function advance() {
    setError(null);
    onPendingChange(true);
    startTransition(async () => {
      try {
        const result = await advanceOrderAction(order.id);
        if (result.status === "success") onSaved(result.order, result.message);
        else if (result.status === "error") setError(result.message);
      } catch {
        setError("The server couldn't be reached. Check your connection and try again.");
      } finally {
        onPendingChange(false);
      }
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">Current status</p>
          <div className="mt-1">
            <StatusBadge status={workflowStatus(order)} />
          </div>
        </div>
        {step.ok ? (
          <button
            type="button"
            onClick={advance}
            disabled={disabled || pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent-100 bg-accent-50 px-3 py-1.5 text-sm font-medium text-accent-700 hover:bg-accent-100 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-60"
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="size-4" aria-hidden />
            )}
            {pending ? "Updating…" : step.label}
          </button>
        ) : (
          <p className="max-w-56 text-xs text-slate-500">{step.reason}</p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2.5 flex items-start gap-1.5 text-xs text-red-600">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

export function OrderEditor({ order, today, onClose, onSaved }: OrderEditorProps) {
  const [pending, setPending] = useState(false);

  return (
    <SlideOver
      title={order ? `Edit ${order.orderNumber}` : "New order"}
      description={
        order
          ? `${order.customer} · ${describeDue(order, today)}`
          : "Adds the order to the dashboard and the production priority queue."
      }
      onClose={onClose}
      locked={pending}
    >
      <OrderForm order={order} today={today} onSaved={onSaved} onCancel={onClose} onPendingChange={setPending}>
        {order && (
          <WorkflowStep order={order} disabled={pending} onSaved={onSaved} onPendingChange={setPending} />
        )}
      </OrderForm>
    </SlideOver>
  );
}
