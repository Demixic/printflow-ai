import { ClipboardList, Flame, LayoutDashboard, Printer, Sparkles, type LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "#overview", icon: LayoutDashboard },
  { label: "Operations brief", href: "#brief", icon: Sparkles },
  { label: "Orders", href: "#orders", icon: ClipboardList },
  { label: "Production priority", href: "#priority", icon: Flame },
];

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-200/80 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent-600 text-white shadow-sm">
          <Printer className="size-4" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-slate-900">PrintFlow AI</p>
          <p className="text-xs text-slate-500">Production workspace</p>
        </div>
      </div>

      <nav aria-label="Dashboard sections" className="flex-1 px-3 py-5">
        <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Dashboard
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
            <li key={href}>
              <a
                href={href}
                onClick={onNavigate}
                className="group flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-accent-500"
              >
                <Icon
                  className="size-4 text-slate-400 transition-colors group-hover:text-accent-600"
                  aria-hidden
                />
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="m-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-700">Demo workspace</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Fictional customers and orders, stored in PostgreSQL.
        </p>
      </div>
    </div>
  );
}
