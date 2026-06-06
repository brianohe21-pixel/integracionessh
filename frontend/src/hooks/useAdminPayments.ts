"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PaymentIntent } from "@/types";

export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => api.get<PaymentIntent[]>("/admin/payments"),
  });
}
