"use client";

import { use, useState, useTransition, type ReactNode } from "react";
import { CircleAlert, Info, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { BriefResult, OperationsBrief, RecommendationPriority } from "@/lib/brief/types";
import { refreshBriefAction } from "@/server/brief/actions";

const PRIORITY_TONES: Record<RecommendationPriority, BadgeTone> = {
  critical: "red",
  high: "amber",
  medium: "accent",
  low: "slate",
};

const PRIORITY_BARS: Record<RecommendationPriority, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-accent-500",
  low: "bg-slate-300",
};

const card = "rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

function Header({
  brief,
  timeZone,
  pending,
  onRefresh,
}: {
  brief?: OperationsBrief;
  timeZone: string;
  pending: boolean;
  onRefresh: () => void;
}) {
  const time = brief
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(
        new Date(brief.generatedAt),
      )
    : null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="brief-heading" className="text-sm font-semibold text-slate-900">
            Operations brief
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            {brief &&
              (brief.source === "ai" ? (
                <Badge tone="accent">AI-generated · {brief.model}</Badge>
              ) : (
                <Badge tone="slate">Rule-based</Badge>
              ))}
            {time && <span>Generated {time}</span>}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="size-3.5" aria-hidden />
        )}
        {pending ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}

function Notice({ tone, children }: { tone: "amber" | "red" | "slate"; children: ReactNode }) {
  const styles = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];
  const Icon = tone === "red" ? CircleAlert : Info;
  return (
    <p className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${styles}`} role={tone === "red" ? "alert" : undefined}>
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

interface OperationsBriefProps {
  /** Streams in from the server; resolves to a brief or a safe error message. */
  briefPromise: Promise<BriefResult>;
  /** Fingerprint of the orders currently on screen, to flag a stale brief. */
  currentFingerprint: string;
  today: string;
  timeZone: string;
  onSelectOrder: (orderNumber: string) => void;
}

export function OperationsBriefPanel({
  briefPromise,
  currentFingerprint,
  today,
  timeZone,
  onSelectOrder,
}: OperationsBriefProps) {
  const initial = use(briefPromise);
  const [refreshed, setRefreshed] = useState<OperationsBrief | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Show whichever brief is newer: the server-streamed one or a manual refresh.
  const candidates = [initial.ok ? initial.brief : null, refreshed].filter((b): b is OperationsBrief => b !== null);
  const brief = candidates.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
  const loadError = !brief && !initial.ok ? initial.message : null;
  const stale = brief && (brief.fingerprint !== currentFingerprint || brief.today !== today);

  function refresh() {
    setRefreshError(null);
    startTransition(async () => {
      try {
        const result = await refreshBriefAction();
        if (result.ok) setRefreshed(result.brief);
        else setRefreshError(result.message);
      } catch {
        setRefreshError("The server couldn't be reached. Check your connection and try again.");
      }
    });
  }

  return (
    <section aria-labelledby="brief-heading" aria-busy={pending} className={card}>
      <Header brief={brief} timeZone={timeZone} pending={pending} onRefresh={refresh} />

      <div className={`space-y-4 px-4 py-4 transition-opacity sm:px-5 ${pending ? "opacity-60" : ""}`}>
        {loadError && <Notice tone="red">{loadError}</Notice>}
        {refreshError && <Notice tone="red">{refreshError}</Notice>}
        {brief?.fallback && (
          <Notice tone="amber">
            {brief.fallback.message} Showing recommendations from PrintFlow&apos;s built-in priority rules.
          </Notice>
        )}
        {stale && (
          <Notice tone="slate">Orders have changed since this brief was generated. Refresh to update it.</Notice>
        )}

        {brief && (
          <>
            <p className="text-sm leading-relaxed text-slate-700">{brief.summary}</p>

            <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {brief.recommendations.map((rec, index) => (
                <li key={index} className="relative overflow-hidden rounded-lg border border-slate-200 p-3.5 pl-4">
                  <span className={`absolute inset-y-0 left-0 w-0.5 ${PRIORITY_BARS[rec.priority]}`} aria-hidden />
                  <div className="flex items-center gap-2">
                    <Badge tone={PRIORITY_TONES[rec.priority]}>
                      <span className="capitalize">{rec.priority}</span>
                    </Badge>
                    <h3 className="min-w-0 truncate text-sm font-medium text-slate-900" title={rec.title}>
                      {rec.title}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{rec.explanation}</p>
                  {rec.orderNumbers.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {rec.orderNumbers.map((orderNumber) => (
                        <button
                          key={orderNumber}
                          type="button"
                          onClick={() => onSelectOrder(orderNumber)}
                          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-600 hover:border-accent-500 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-accent-500"
                          aria-label={`Show ${orderNumber} in the orders table`}
                        >
                          {orderNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>

            <p className="text-[11px] leading-relaxed text-slate-400">
              Counts and urgency come from PrintFlow&apos;s priority rules.
              {brief.source === "ai" &&
                " Gemini only suggests actions; it can't change orders, and every order it cites is checked against your data."}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export function OperationsBriefSkeleton() {
  return (
    <section className={`${card} animate-pulse`} aria-busy="true" aria-label="Loading operations brief">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div className="size-8 rounded-lg bg-slate-200/70" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-slate-200/70" />
          <div className="h-3 w-24 rounded bg-slate-200/70" />
        </div>
      </div>
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div className="h-3 w-full rounded bg-slate-200/70" />
        <div className="h-3 w-2/3 rounded bg-slate-200/70" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="h-20 rounded-lg bg-slate-200/70" />
          <div className="h-20 rounded-lg bg-slate-200/70" />
        </div>
      </div>
      <p className="sr-only" role="status">
        Preparing the operations brief…
      </p>
    </section>
  );
}
