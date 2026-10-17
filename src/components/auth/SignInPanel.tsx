"use client";

import { useActionState } from "react";
import { CircleAlert, Eye, LoaderCircle, LockKeyhole } from "lucide-react";
import { signInAction, startDemoAction, type SignInState } from "@/server/auth/actions";

const IDLE: SignInState = { status: "idle" };
const inputClass =
  "block h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 disabled:bg-slate-50";

function ErrorMessage({ state }: { state: SignInState }) {
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {state.message}
    </p>
  );
}

interface SignInPanelProps {
  demoAvailable: boolean;
  editorAvailable: boolean;
}

export function SignInPanel({ demoAvailable, editorAvailable }: SignInPanelProps) {
  const [signInState, signIn, signingIn] = useActionState(signInAction, IDLE);
  const [demoState, startDemo, startingDemo] = useActionState(async () => startDemoAction(), IDLE);
  const busy = signingIn || startingDemo;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {demoAvailable && (
        <form action={startDemo} className="space-y-3 border-b border-slate-200 p-5">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">Explore the demo</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Browse fictional orders, filters and the operations brief. The demo is read-only: it can&apos;t create
              or change orders.
            </p>
          </div>
          <ErrorMessage state={demoState} />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:opacity-70"
          >
            {startingDemo ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            View read-only demo
          </button>
        </form>
      )}

      {editorAvailable ? (
        <form action={signIn} className="space-y-3 p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Editor sign-in</h2>
            <p className="mt-1 text-xs text-slate-500">For shop staff who create and update orders.</p>
          </div>
          <ErrorMessage state={signInState} />
          <div>
            <label htmlFor="username" className="block text-xs font-medium text-slate-700">
              Username
            </label>
            <input id="username" name="username" autoComplete="username" required disabled={busy} className={`mt-1.5 ${inputClass}`} />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-70"
          >
            {signingIn ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <LockKeyhole className="size-4" aria-hidden />}
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        !demoAvailable && (
          <p className="p-5 text-sm text-slate-600">
            Sign-in isn&apos;t configured on this deployment. Set AUTH_SECRET and the editor credentials on the server.
          </p>
        )
      )}
    </div>
  );
}
