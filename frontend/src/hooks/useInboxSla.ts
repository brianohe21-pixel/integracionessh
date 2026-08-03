"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Conversation, InboxSlaSettings } from "@/types";
import { getConversationSlaStatus, resolveInboxSlaSettings } from "@/lib/inbox-sla";

async function fetchInboxSlaSettings(): Promise<InboxSlaSettings> {
  const data = await api.get<InboxSlaSettings>("/tenants/me/inbox-sla");
  return resolveInboxSlaSettings(data);
}

export function useInboxSlaSettings() {
  return useQuery({
    queryKey: ["inbox-sla-settings"],
    queryFn: fetchInboxSlaSettings,
  });
}

export function useSaveInboxSlaSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: InboxSlaSettings) =>
      api.put<InboxSlaSettings>("/tenants/me/inbox-sla", settings),
    onSuccess: (data) => {
      queryClient.setQueryData(["inbox-sla-settings"], resolveInboxSlaSettings(data));
      queryClient.invalidateQueries({ queryKey: ["metrics", "inbox-sla"] });
    },
  });
}

export function useConversationSlaStatus(
  conversation: Pick<
    Conversation,
    "handoffMode" | "handoffAt" | "firstHumanResponseAt" | "workflowStatus"
  >
) {
  const { data: settings } = useInboxSlaSettings();
  const resolved = resolveInboxSlaSettings(settings);
  return getConversationSlaStatus(conversation, resolved);
}
