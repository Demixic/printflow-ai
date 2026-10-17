import type { ReactNode } from "react";
import { Menu } from "lucide-react";

interface HeaderProps {
  onOpenMenu: () => void;
  meta?: ReactNode;
}

export function Header({ onOpenMenu, meta }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        className="-ml-1 inline-flex size-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-accent-500 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-slate-900">
          Production dashboard
        </h1>
        <p className="hidden truncate text-xs text-slate-500 sm:block">
          Orders, deadlines and what the floor should print next
        </p>
      </div>

      <div className="flex items-center gap-3">
        {meta}
      </div>
    </header>
  );
}
