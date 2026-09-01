import type { ReactNode } from "react";
import { Wallet } from "lucide-react";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-muted)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand-600)] text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Plataforma Financiera</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
