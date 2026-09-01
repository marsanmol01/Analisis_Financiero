import { Navigate, Outlet, useLocation } from "react-router";
import { useCurrentUser } from "../../hooks/use-auth";
import { Spinner } from "../ui/spinner";

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-6 w-6 text-[var(--color-brand-600)]" />
    </div>
  );
}

export function ProtectedRoute() {
  const { data: user, isLoading } = useCurrentUser();
  const location = useLocation();

  if (isLoading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <Outlet />;
}

// Evita que alguien ya autenticado vea el formulario de login/registro otra vez.
export function PublicOnlyRoute() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) return <FullScreenSpinner />;
  if (user) return <Navigate to="/" replace />;

  return <Outlet />;
}
