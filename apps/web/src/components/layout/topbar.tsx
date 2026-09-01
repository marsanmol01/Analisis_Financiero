import { LogOut } from "lucide-react";
import { Button } from "../ui/button";
import { useCurrentUser, useLogout } from "../../hooks/use-auth";

export function Topbar() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-white px-4 md:px-6">
      <span className="text-sm font-semibold text-slate-900 md:hidden">Plataforma Financiera</span>
      <div className="ml-auto flex items-center gap-4">
        {user && <span className="text-sm text-[var(--color-text-muted)]">{user.email}</span>}
        <Button variant="ghost" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
      </div>
    </header>
  );
}
