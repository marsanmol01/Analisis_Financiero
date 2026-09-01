import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api-client";
import type { User } from "../types/auth";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

// null = comprobado y no hay sesion (nunca un error de red silencioso: eso sigue lanzando).
export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        return await api.get<User>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => api.post<User>("/auth/login", input),
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => api.post<User>("/auth/register", input),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: async () => {
      // Se purgan los datos del usuario anterior (cuentas, transacciones...) pero la query de
      // auth se invalida en vez de fijarse a mano con setQueryData: queryClient.clear() borra
      // tambien la entrada de cache que un setQueryData posterior necesitaria, y el observador
      // de ProtectedRoute no se refresca de forma fiable en ese orden. Invalidar fuerza una
      // comprobacion real contra el servidor (GET /auth/me -> 401 -> null) y reutiliza el mismo
      // camino reactivo ya verificado (isLoading -> data) que la carga inicial de la pagina.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    },
  });
}
