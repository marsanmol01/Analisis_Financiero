import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type QueryValue } from "../lib/api-client";
import type { DetectTransfersResult, InternalTransfer, InternalTransferStatus } from "../types/transfer";

export function useTransfers(status?: InternalTransferStatus) {
  return useQuery({
    queryKey: ["transfers", status ?? "all"],
    queryFn: () => api.get<InternalTransfer[]>("/transfers", { status } as Record<string, QueryValue>),
  });
}

function useInvalidateTransfers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["transfers"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useDetectTransfers() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: (input: { accountId?: string; toleranceDays?: number }) =>
      api.post<DetectTransfersResult>("/transfers/detect", input),
    onSuccess: invalidate,
  });
}

export function useUpdateTransferStatus() {
  const invalidate = useInvalidateTransfers();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: InternalTransferStatus }) =>
      api.patch<InternalTransfer>(`/transfers/${id}`, { status }),
    onSuccess: invalidate,
  });
}
