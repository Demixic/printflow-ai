"use client";

import { useEffect } from "react";
import { DatabaseZap, RotateCcw } from "lucide-react";

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <DatabaseZap className="size-5" aria-hidden />
      </span>
      <h2 className="mt-4 text-sm font-semibold text-slate-900">Orders couldn&apos;t be loaded</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        The order database didn&apos;t respond. Please try again in a moment.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
      >
        <RotateCcw className="size-4" aria-hidden />
        Try again
      </button>
    </div>
  );
}
