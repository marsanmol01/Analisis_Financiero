import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { Merchant } from "../types/merchant";

export function useMerchants() {
  return useQuery({
    queryKey: ["merchants"],
    queryFn: () => api.get<Merchant[]>("/merchants"),
  });
}
