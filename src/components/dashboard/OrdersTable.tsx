import { Pencil, Zap } from "lucide-react";
import {
  METHOD_LABELS,
  daysUntil,
  describeDue,
  formatDate,
  isOpen,
  isOverdue,
  workflowStatus,
  type Order,
} from "@/lib/orders";
import { StatusBadge } from "./StatusBadge";

function dueTone(order: Order, today: string): string {
  if (isOverdue(order, today)) return "text-red-600";
  if (isOpen(order) && daysUntil(order.dueDate, today) === 0) return "text-amber-700";
  return "text-slate-500";
}

function RushTag() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200/70">
      <Zap className="size-2.5" aria-hidden />
      Rush
    </span>
  );
}

function ProductCell({ order }: { order: Order }) {
  return (
    <>
      <span className="line-clamp-2 text-slate-900">{order.product}</span>
      <span className="mt-0.5 block text-xs text-slate-500">
        {order.quantity.toLocaleString("en-US")} units · {METHOD_LABELS[order.method]}
      </span>
    </>
  );
}

function DueCell({ order, today }: { order: Order; today: string }) {
  return (
    <>
      <p className="tabular-nums text-slate-900">{formatDate(order.dueDate)}</p>
      <p className={`mt-0.5 text-xs font-medium ${dueTone(order, today)}`}>{describeDue(order, today)}</p>
    </>
  );
}

interface OrdersTableProps {
  orders: Order[];
  today: string;
  /** Omit for read-only access: rows are then shown without edit controls. */
  onEdit?: (order: Order) => void;
  /** Briefly highlights a row, e.g. one that was just saved. */
  highlightedId?: string | null;
}

export function OrdersTable({ orders, today, onEdit, highlightedId }: OrdersTableProps) {
  const highlight = (order: Order) => (order.id === highlightedId ? "bg-accent-50/60" : "");

  return (
    <>
      {/* Mobile: stacked cards; each opens the editor when editing is allowed */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {orders.map((order) => {
          const content = (
            <>
                <span className="flex items-start justify-between gap-3">
                  <span className="block min-w-0">
                    <span className="flex items-center gap-2 font-mono text-xs font-medium text-slate-500">
                      {order.orderNumber}
                      {order.rush && <RushTag />}
                    </span>
                    <span className="block mt-0.5 truncate text-sm font-medium text-slate-900">{order.customer}</span>
                  </span>
                  <StatusBadge status={workflowStatus(order)} />
                </span>
                <span className="block mt-2 text-sm">
                  <ProductCell order={order} />
                </span>
                <span className="block mt-2 text-xs">
                  <span className="text-slate-500">Due {formatDate(order.dueDate)} · </span>
                  <span className={`font-medium ${dueTone(order, today)}`}>{describeDue(order, today)}</span>
                </span>
            </>
          );
          return (
            <li key={order.id} className={`transition-colors ${highlight(order)}`}>
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(order)}
                  className="block w-full px-4 py-4 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-500"
                >
                  <span className="sr-only">Edit order </span>
                  {content}
                </button>
              ) : (
                <div className="px-4 py-4">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Tablet and up: table */}
      <div className="hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
              <th scope="col" className="w-28 px-5 py-2.5 font-medium">Order</th>
              <th scope="col" className="w-[22%] px-3 py-2.5 font-medium">Customer</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Product</th>
              <th scope="col" className="w-28 px-3 py-2.5 font-medium">Due date</th>
              <th scope="col" className="w-40 px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr
                key={order.id}
                onClick={onEdit && (() => onEdit(order))}
                className={`group align-top transition-colors hover:bg-slate-50/70 ${onEdit ? "cursor-pointer" : ""} ${highlight(order)}`}
              >
                <td className="px-5 py-3.5">
                  {onEdit ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(order);
                      }}
                      aria-label={`Edit order ${order.orderNumber}, ${order.customer}`}
                      className="-mx-1 inline-flex items-center gap-1 whitespace-nowrap rounded px-1 font-mono text-xs font-medium text-slate-700 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent-500"
                    >
                      {order.orderNumber}
                      <Pencil
                        className="size-3 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <span className="whitespace-nowrap font-mono text-xs font-medium text-slate-700">
                      {order.orderNumber}
                    </span>
                  )}
                  {order.rush && (
                    <p className="mt-1">
                      <RushTag />
                    </p>
                  )}
                </td>
                <td className="px-3 py-3.5">
                  <p className="truncate font-medium text-slate-900" title={order.customer}>
                    {order.customer}
                  </p>
                </td>
                <td className="px-3 py-3.5" title={order.product}>
                  <ProductCell order={order} />
                </td>
                <td className="px-3 py-3.5">
                  <DueCell order={order} today={today} />
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={workflowStatus(order)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
