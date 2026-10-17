"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface SlideOverProps {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** While true, Escape / backdrop clicks are ignored (e.g. a save is in flight). */
  locked?: boolean;
  children: ReactNode;
}

/**
 * Right-hand panel built on the native <dialog> element, which provides the
 * modal focus trap, inert background and Escape handling.
 */
export function SlideOver({ title, description, onClose, locked = false, children }: SlideOverProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="slide-over-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) onClose();
      }}
      onClick={(event) => {
        // Clicks on the ::backdrop target the dialog element itself.
        if (event.target === event.currentTarget && !locked) onClose();
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-lg border-0 bg-transparent p-0 backdrop:bg-slate-900/30 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex h-full flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="slide-over-title" className="text-base font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            {description && <div className="mt-1 text-xs text-slate-500">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-accent-500 disabled:opacity-40"
            aria-label="Close panel"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}
