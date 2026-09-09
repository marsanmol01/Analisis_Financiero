import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import { AUTH_QUERY_KEY } from "./use-auth";
import type { User } from "../types/auth";

export interface TotpSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface EnableTotpResult {
  user: User;
  recoveryCodes: string[];
}

export function useSetupTotp() {
  return useMutation({
    mutationFn: () => api.post<TotpSetupResult>("/auth/2fa/setup"),
  });
}

export function useEnableTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.post<EnableTotpResult>("/auth/2fa/enable", { code }),
    onSuccess: (result) => queryClient.setQueryData(AUTH_QUERY_KEY, result.user),
  });
}

export function useDisableTotp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { password: string; code: string }) => api.post<User>("/auth/2fa/disable", input),
    onSuccess: (user) => queryClient.setQueryData(AUTH_QUERY_KEY, user),
  });
}

export function useRecoveryCodesStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["auth", "recovery-codes", "status"],
    queryFn: () => api.get<{ remaining: number }>("/auth/2fa/recovery-codes/status"),
    enabled,
  });
}

export function useRegenerateRecoveryCodes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      api.post<{ recoveryCodes: string[] }>("/auth/2fa/recovery-codes/regenerate", { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "recovery-codes", "status"] });
    },
  });
}
