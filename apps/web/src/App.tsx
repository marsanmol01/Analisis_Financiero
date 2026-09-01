import { createBrowserRouter, RouterProvider } from "react-router";
import { ProtectedRoute, PublicOnlyRoute } from "./components/auth/protected-route";
import { AppLayout } from "./components/layout/app-layout";
import { LoginPage } from "./pages/auth/login-page";
import { RegisterPage } from "./pages/auth/register-page";
import { DashboardPage } from "./pages/dashboard/dashboard-page";
import { AccountsPage } from "./pages/accounts/accounts-page";
import { CategoriesPage } from "./pages/categories/categories-page";
import { TransactionsPage } from "./pages/transactions/transactions-page";
import { ImportsPage } from "./pages/imports/imports-page";
import { NewImportPage } from "./pages/imports/new-import-page";
import { ComingSoonPage } from "./pages/coming-soon-page";

const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/transactions", element: <TransactionsPage /> },
          { path: "/accounts", element: <AccountsPage /> },
          { path: "/categories", element: <CategoriesPage /> },
          { path: "/budgets", element: <ComingSoonPage title="Presupuestos" /> },
          { path: "/savings-goals", element: <ComingSoonPage title="Objetivos de ahorro" /> },
          { path: "/recurring", element: <ComingSoonPage title="Gastos recurrentes" /> },
          { path: "/transfers", element: <ComingSoonPage title="Transferencias internas" /> },
          { path: "/merchants", element: <ComingSoonPage title="Comercios" /> },
          { path: "/classification-rules", element: <ComingSoonPage title="Reglas de clasificación" /> },
          { path: "/imports", element: <ImportsPage /> },
          { path: "/imports/new", element: <NewImportPage /> },
          { path: "/analytics", element: <ComingSoonPage title="Estadísticas" /> },
          { path: "/settings", element: <ComingSoonPage title="Configuración" /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
