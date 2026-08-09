"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  MailrelayCampaign,
  MailrelayCampaignInput,
  MailrelayCampaignMetrics,
  MailrelayConfig,
  MailrelayCredentials,
  MailrelayCredentialsInput,
  MailrelayGroup,
  MailrelaySender,
  MailrelaySync,
} from "@/types";

const key = ["email-marketing"] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeConfig(value: unknown): MailrelayConfig {
  const raw = record(value);
  const defaultGroupIds = Array.isArray(raw.defaultGroupIds) ? raw.defaultGroupIds : [];
  const mappings = Array.isArray(raw.tagGroupMappings) ? raw.tagGroupMappings : [];
  return {
    senderId: String(raw.senderId ?? raw.defaultSenderId ?? ""),
    defaultGroupId: String(raw.defaultGroupId ?? defaultGroupIds[0] ?? ""),
    tagGroupMappings: mappings.map((value) => {
      const mapping = record(value);
      const groupIds = Array.isArray(mapping.groupIds) ? mapping.groupIds : [];
      return {
        tag: String(mapping.tag ?? ""),
        groupId: String(mapping.groupId ?? groupIds[0] ?? ""),
      };
    }),
    enabled: raw.enabled !== false,
    eventTypes: Array.isArray(raw.eventTypes)
      ? raw.eventTypes.map((eventType) => String(eventType))
      : [],
  };
}

function configPayload(config: MailrelayConfig) {
  return {
    enabled: config.enabled !== false,
    defaultSenderId: config.senderId ? Number(config.senderId) : undefined,
    defaultGroupIds: config.defaultGroupId ? [Number(config.defaultGroupId)] : [],
    tagGroupMappings: config.tagGroupMappings.map((mapping) => ({
      tag: mapping.tag,
      groupIds: mapping.groupId ? [Number(mapping.groupId)] : [],
    })),
    eventTypes: config.eventTypes ?? [],
  };
}

function normalizeSync(value: unknown): MailrelaySync {
  const raw = record(value);
  const total = Number(raw.total ?? 0);
  const processed = Number(raw.processed ?? 0);
  const rawStatus = String(raw.status ?? "pending");
  const status =
    rawStatus === "queued"
      ? "pending"
      : rawStatus === "completed_with_errors"
        ? "completed"
        : rawStatus === "running" || rawStatus === "completed" || rawStatus === "failed"
          ? rawStatus
          : "pending";
  return {
    id: String(raw.id ?? raw.jobId ?? ""),
    status,
    progress: total > 0 ? Math.round((processed / total) * 100) : status === "completed" ? 100 : 0,
    processed,
    total,
    createdAt: String(raw.createdAt ?? ""),
    completedAt: raw.completedAt ? String(raw.completedAt) : undefined,
    error: raw.error ? String(raw.error) : undefined,
  };
}

function normalizeCampaign(value: unknown, defaultStatus: MailrelayCampaign["status"] = "draft") {
  const raw = record(value);
  const groupIds = Array.isArray(raw.groupIds)
    ? raw.groupIds
    : Array.isArray(raw.group_ids)
      ? raw.group_ids
      : [];
  const rawStatus = String(raw.status ?? defaultStatus);
  const status =
    rawStatus === "sent" || rawStatus === "sending" || rawStatus === "draft"
      ? rawStatus
      : defaultStatus;
  return {
    id: String(raw.id ?? raw.campaignId ?? ""),
    name: String(raw.name ?? raw.subject ?? ""),
    subject: String(raw.subject ?? ""),
    previewText: String(raw.previewText ?? raw.preview_text ?? ""),
    html: String(raw.html ?? ""),
    senderId: String(raw.senderId ?? raw.sender_id ?? ""),
    groupIds: groupIds.map((id) => String(id)),
    trackOpens: Boolean(raw.trackOpens ?? raw.track_opens ?? true),
    trackClicks: Boolean(raw.trackClicks ?? raw.track_clicks ?? true),
    status,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ""),
    sentAt: raw.sentAt || raw.sent_at ? String(raw.sentAt ?? raw.sent_at) : undefined,
  } satisfies MailrelayCampaign;
}

function ensureUnsubscribeHtml(html: string): string {
  if (/unsubscribe_url|%UNSUBSCRIBE%/i.test(html)) return html.trim();
  return `${html.trim()}\n<p style="font-size:12px;color:#666;margin-top:24px;"><a href="{{ unsubscribe_url }}">Unsubscribe</a></p>`;
}

function campaignPayload(payload: MailrelayCampaignInput) {
  return {
    sender_id: Number(payload.senderId),
    subject: payload.subject,
    ...(payload.previewText ? { preview_text: payload.previewText } : {}),
    html: ensureUnsubscribeHtml(payload.html),
    target: "groups",
    group_ids: payload.groupIds.map(Number),
    track_opens: payload.trackOpens,
    track_clicks: payload.trackClicks,
  };
}

export function useMailrelayCredentials() {
  return useQuery<{ credentials: MailrelayCredentials }>({
    queryKey: [...key, "credentials"],
    queryFn: () => api.get("/email-marketing/credentials"),
  });
}

export function useSaveMailrelayCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MailrelayCredentialsInput) =>
      api.put<{ credentials: MailrelayCredentials }>("/email-marketing/credentials", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useDeleteMailrelayCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/email-marketing/credentials"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useTestMailrelayConnection() {
  return useMutation({
    mutationFn: () => api.post<{ success: boolean }>("/email-marketing/test", {}),
  });
}

export function useMailrelayConfig(enabled = true) {
  return useQuery<{ config: MailrelayConfig }>({
    queryKey: [...key, "config"],
    queryFn: async () => {
      const response = await api.get<{ config: unknown }>("/email-marketing/config");
      return { config: normalizeConfig(response.config) };
    },
    enabled,
  });
}

export function useSaveMailrelayConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MailrelayConfig) =>
      api
        .put<{ config: unknown }>("/email-marketing/config", configPayload(payload))
        .then((response) => ({ config: normalizeConfig(response.config) })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...key, "config"] });
    },
  });
}

export function useMailrelayGroups(enabled = true) {
  return useQuery<{ groups: MailrelayGroup[] }>({
    queryKey: [...key, "groups"],
    queryFn: async () => {
      const response = await api.get<{ groups: unknown[] }>("/email-marketing/groups");
      return {
        groups: response.groups.map((value) => {
          const group = record(value);
          return {
            id: String(group.id ?? ""),
            name: String(group.name ?? ""),
            subscriberCount:
              (group.subscriberCount ?? group.subscriber_count ?? group.subscribers_count) == null
                ? undefined
                : Number(
                    group.subscriberCount ?? group.subscriber_count ?? group.subscribers_count
                  ),
          };
        }),
      };
    },
    enabled,
  });
}

export function useMailrelaySenders(enabled = true) {
  return useQuery<{ senders: MailrelaySender[] }>({
    queryKey: [...key, "senders"],
    queryFn: async () => {
      const response = await api.get<{ senders: unknown[] }>("/email-marketing/senders");
      return {
        senders: response.senders.map((value) => {
          const sender = record(value);
          return {
            id: String(sender.id ?? ""),
            name: String(sender.from_name ?? sender.name ?? sender.email ?? ""),
            email: String(sender.email ?? ""),
          };
        }),
      };
    },
    enabled,
  });
}

export function useStartMailrelaySync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await api.post<{ sync?: unknown; job?: unknown }>("/email-marketing/sync", {});
      return { sync: normalizeSync(response.sync ?? response.job) };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...key, "syncs"] });
    },
  });
}

export function useMailrelaySyncs(enabled = true) {
  return useQuery<{ syncs: MailrelaySync[] }>({
    queryKey: [...key, "syncs"],
    queryFn: async () => {
      const response = await api.get<{ syncs?: unknown[]; jobs?: unknown[] }>("/email-marketing/syncs");
      return { syncs: (response.syncs ?? response.jobs ?? []).map(normalizeSync) };
    },
    enabled,
    refetchInterval: (query) => {
      const syncs = query.state.data?.syncs ?? [];
      return syncs.some((sync) => sync.status === "pending" || sync.status === "running")
        ? 2000
        : false;
    },
  });
}

export function useMailrelaySync(syncId: string) {
  return useQuery<{ sync: MailrelaySync }>({
    queryKey: [...key, "syncs", syncId],
    queryFn: async () => {
      const response = await api.get<{ sync?: unknown; job?: unknown }>(
        `/email-marketing/syncs/${syncId}`
      );
      return { sync: normalizeSync(response.sync ?? response.job) };
    },
    enabled: Boolean(syncId),
    refetchInterval: (query) => {
      const status = query.state.data?.sync.status;
      return status === "pending" || status === "running" ? 2000 : false;
    },
  });
}

export function useMailrelayCampaigns(enabled = true) {
  return useQuery<{ campaigns: MailrelayCampaign[] }>({
    queryKey: [...key, "campaigns"],
    queryFn: async () => {
      const response = await api.get<{ campaigns: unknown[] }>("/email-marketing/campaigns");
      return { campaigns: response.campaigns.map((campaign) => normalizeCampaign(campaign)) };
    },
    enabled,
  });
}

export function useCreateMailrelayCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MailrelayCampaignInput) => {
      const response = await api.post<{ campaign: unknown }>(
        "/email-marketing/campaigns",
        campaignPayload(payload)
      );
      return { campaign: normalizeCampaign(response.campaign) };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...key, "campaigns"] });
    },
  });
}

export function useMailrelayCampaign(campaignId: string) {
  return useQuery<{ campaign: MailrelayCampaign }>({
    queryKey: [...key, "campaigns", campaignId],
    queryFn: async () => {
      const response = await api.get<{ campaign: unknown }>(
        `/email-marketing/campaigns/${campaignId}`
      );
      return { campaign: normalizeCampaign(response.campaign) };
    },
    enabled: Boolean(campaignId),
  });
}

export function useUpdateMailrelayCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: MailrelayCampaignInput }) => {
      const response = await api.put<{ campaign: unknown }>(
        `/email-marketing/campaigns/${id}`,
        campaignPayload(payload)
      );
      return { campaign: normalizeCampaign(response.campaign) };
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: [...key, "campaigns"] });
      void queryClient.invalidateQueries({
        queryKey: [...key, "campaigns", variables.id],
      });
    },
  });
}

export function useDeleteMailrelayCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/email-marketing/campaigns/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...key, "campaigns"] });
    },
  });
}

export function useSendMailrelayTest() {
  return useMutation({
    mutationFn: ({ id, emails }: { id: string; emails: string[] }) =>
      api.post<{ success: boolean }>(`/email-marketing/campaigns/${id}/send-test`, { emails }),
  });
}

export function useSendMailrelayCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaign: Pick<MailrelayCampaign, "id" | "groupIds">) => {
      const response = await api.post<{ campaign: unknown }>(
        `/email-marketing/campaigns/${campaign.id}/send`,
        {
          target: "groups",
          group_ids: campaign.groupIds.map(Number),
        }
      );
      return { campaign: normalizeCampaign(response.campaign, "sending") };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...key, "campaigns"] });
      void queryClient.invalidateQueries({ queryKey: [...key, "sent-campaigns"] });
    },
  });
}

export function useMailrelaySentCampaigns(enabled = true) {
  return useQuery<{ campaigns: MailrelayCampaign[] }>({
    queryKey: [...key, "sent-campaigns"],
    queryFn: async () => {
      const response = await api.get<{ campaigns: unknown[] }>("/email-marketing/sent-campaigns");
      return {
        campaigns: response.campaigns.map((campaign) => normalizeCampaign(campaign, "sent")),
      };
    },
    enabled,
  });
}

export function useMailrelayCampaignMetrics(campaignId: string) {
  return useQuery<{ metrics: MailrelayCampaignMetrics }>({
    queryKey: [...key, "sent-campaigns", campaignId, "metrics"],
    queryFn: async () => {
      const response = await api.get<{ metrics: unknown }>(
        `/email-marketing/sent-campaigns/${campaignId}/metrics`
      );
      const metrics = record(response.metrics);
      return {
        metrics: {
          campaignId: String(metrics.campaignId ?? campaignId),
          sent: Number(metrics.sent ?? 0),
          delivered: Number(metrics.delivered ?? 0),
          opens: Number(metrics.opens ?? metrics.opened ?? 0),
          clicks: Number(metrics.clicks ?? metrics.clicked ?? 0),
          bounces: Number(metrics.bounces ?? metrics.bounced ?? 0),
          unsubscribes: Number(metrics.unsubscribes ?? metrics.unsubscribed ?? 0),
        },
      };
    },
    enabled: Boolean(campaignId),
  });
}
