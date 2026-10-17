"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
  /** Server-rendered content for the right side of the header (e.g. today's date). */
  headerMeta?: ReactNode;
}

export function AppShell({ children, headerMeta }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200/80 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]"
            onClick={closeMenu}
            aria-label="Close navigation"
            tabIndex={-1}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">
            <Sidebar onNavigate={closeMenu} />
            <button
              type="button"
              onClick={closeMenu}
              className="absolute right-3 top-4 inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-accent-500"
              aria-label="Close navigation"
              autoFocus
            >
              <X className="size-4" aria-hidden />
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <Header onOpenMenu={() => setMenuOpen(true)} meta={headerMeta} />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
