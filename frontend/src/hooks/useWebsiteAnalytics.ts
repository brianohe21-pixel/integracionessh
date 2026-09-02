"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WebsiteAnalyticsSettings } from "@/types";
import { resolveWebsiteAnalyticsSettings } from "@/lib/website-analytics";

async function fetchWebsiteAnalyticsSettings(): Promise<WebsiteAnalyticsSettings> {
  const data = await api.get<WebsiteAnalyticsSettings>("/tenants/me/website-analytics");
  return resolveWebsiteAnalyticsSettings(data);
}

export function useWebsiteAnalyticsSettings() {
  return useQuery({
    queryKey: ["website-analytics-settings"],
    queryFn: fetchWebsiteAnalyticsSettings,
  });
}

export function useSaveWebsiteAnalyticsSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: WebsiteAnalyticsSettings) =>
      api.put<WebsiteAnalyticsSettings>("/tenants/me/website-analytics", settings),
    onSuccess: (data) => {
      queryClient.setQueryData(
        ["website-analytics-settings"],
        resolveWebsiteAnalyticsSettings(data)
      );
    },
  });
}
