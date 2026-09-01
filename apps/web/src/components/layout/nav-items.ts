import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  ListChecks,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  ShoppingBag,
  Tags,
  Target,
  Upload,
  Wallet,
  BarChart3,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

// Refleja las secciones principales previstas en el diseño (docs/architecture.md).
export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transacciones", icon: Receipt },
  { to: "/accounts", label: "Cuentas", icon: Wallet },
  { to: "/categories", label: "Categorías", icon: Tags },
  { to: "/budgets", label: "Presupuestos", icon: PiggyBank },
  { to: "/savings-goals", label: "Objetivos", icon: Target },
  { to: "/recurring", label: "Recurrentes", icon: Repeat },
  { to: "/transfers", label: "Transferencias", icon: ArrowLeftRight },
  { to: "/merchants", label: "Comercios", icon: ShoppingBag },
  { to: "/classification-rules", label: "Reglas", icon: ListChecks },
  { to: "/imports", label: "Importaciones", icon: Upload },
  { to: "/analytics", label: "Estadísticas", icon: BarChart3 },
  { to: "/settings", label: "Configuración", icon: Settings },
];
