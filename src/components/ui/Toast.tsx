"use client";

import { useEffect } from "react";
import { CircleCheck, X } from "lucide-react";

export interface ToastMessage {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}

/** Single success toast, announced politely to screen readers. */
export function Toast({ toast, onDismiss, durationMs = 5000 }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss, durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {toast && (
        <div
          key={toast.id}
          className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg"
        >
          <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden />
          <p className="min-w-0 flex-1 text-slate-800">{toast.message}</p>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onDismiss();
              }}
              className="shrink-0 text-xs font-medium text-accent-600 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent-500"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Dismiss notification"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
