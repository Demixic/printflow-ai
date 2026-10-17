import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Printer } from "lucide-react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { readAuthConfig } from "@/server/auth/config";
import { getSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Sign in — PrintFlow AI",
};

/** Reads the auth configuration and session at request time, never at build time. */
async function SignInContent() {
  await connection();
  if (await getSession()) redirect("/");
  const { secret, editor, demoViewerEnabled } = readAuthConfig();
  return (
    <SignInPanel
      demoAvailable={Boolean(secret) && demoViewerEnabled}
      editorAvailable={Boolean(secret) && editor !== null}
    />
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent-600 text-white shadow-sm">
            <Printer className="size-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight text-slate-900">PrintFlow AI</p>
            <p className="text-xs text-slate-500">Production workspace</p>
          </div>
        </div>
        <Suspense fallback={<div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />}>
          <SignInContent />
        </Suspense>
      </div>
    </main>
  );
}
