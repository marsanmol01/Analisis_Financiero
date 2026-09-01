import { NavLink } from "react-router";
import { Wallet } from "lucide-react";
import { cn } from "../../lib/cn";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--color-border)] px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-600)] text-white">
          <Wallet className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-slate-900">Plataforma Financiera</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
