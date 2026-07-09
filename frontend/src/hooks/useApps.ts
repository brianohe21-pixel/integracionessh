"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AppCatalogItem } from "@/types";

export function useApps() {
  return useQuery<{ apps: AppCatalogItem[] }>({
    queryKey: ["apps"],
    queryFn: () => api.get<{ apps: AppCatalogItem[] }>("/apps"),
  });
}
