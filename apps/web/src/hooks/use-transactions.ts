import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryValue } from "../lib/api-client";
import type {
  TransactionFilters,
  TransactionListResponse,
  UpdateTransactionInput,
  UpdateTransactionResult,
} from "../types/transaction";

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => api.get<TransactionListResponse>("/transactions", filters as Record<string, QueryValue>),
    // Evita el parpadeo a "cargando" al cambiar de pagina o filtro: se sigue mostrando la
    // pagina anterior hasta que la nueva este lista.
    placeholderData: keepPreviousData,
  });
}

function useInvalidateTransactions() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateTransactions();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTransactionInput }) =>
      api.patch<UpdateTransactionResult>(`/transactions/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateTransactions();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: invalidate,
  });
}
