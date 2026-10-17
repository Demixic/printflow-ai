import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { signOutAction } from "@/server/auth/actions";
import { getSession } from "@/server/auth/session";

/** Who is signed in, their access level, and a sign-out button. */
export async function SessionMenu() {
  const session = await getSession();
  if (!session) return null;
  const editor = session.role === "editor";

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline-flex">
        <Badge tone={editor ? "accent" : "slate"}>{editor ? `Editor · ${session.subject}` : "Read-only demo"}</Badge>
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-accent-500"
        >
          <LogOut className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
          <span className="sr-only sm:hidden">Sign out</span>
        </button>
      </form>
    </div>
  );
}
