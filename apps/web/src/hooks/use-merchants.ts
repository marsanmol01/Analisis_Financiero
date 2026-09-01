import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { Merchant, MerchantAlias, MerchantInput } from "../types/merchant";

export const MERCHANTS_QUERY_KEY = ["merchants"] as const;

export function useMerchants() {
  return useQuery({
    queryKey: MERCHANTS_QUERY_KEY,
    queryFn: () => api.get<Merchant[]>("/merchants"),
  });
}

function useInvalidateMerchants() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: MERCHANTS_QUERY_KEY });
}

export function useCreateMerchant() {
  const invalidate = useInvalidateMerchants();
  return useMutation({
    mutationFn: (input: MerchantInput) => api.post<Merchant>("/merchants", input),
    onSuccess: invalidate,
  });
}

export function useUpdateMerchant() {
  const invalidate = useInvalidateMerchants();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MerchantInput }) => api.patch<Merchant>(`/merchants/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteMerchant() {
  const invalidate = useInvalidateMerchants();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/merchants/${id}`),
    onSuccess: invalidate,
  });
}

export function useAddMerchantAlias() {
  const invalidate = useInvalidateMerchants();
  return useMutation({
    mutationFn: ({ merchantId, pattern }: { merchantId: string; pattern: string }) =>
      api.post<MerchantAlias>(`/merchants/${merchantId}/aliases`, { pattern }),
    onSuccess: invalidate,
  });
}

export function useRemoveMerchantAlias() {
  const invalidate = useInvalidateMerchants();
  return useMutation({
    mutationFn: ({ merchantId, aliasId }: { merchantId: string; aliasId: string }) =>
      api.delete(`/merchants/${merchantId}/aliases/${aliasId}`),
    onSuccess: invalidate,
  });
}
