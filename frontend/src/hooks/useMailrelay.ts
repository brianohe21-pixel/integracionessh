"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  MailrelayCampaign,
  MailrelayCampaignFolder,
  MailrelayCampaignInput,
  MailrelayCampaignMetrics,
  MailrelayConfig,
  MailrelayDeliverabilityCampaign,
  MailrelayDeliverabilityDailyPoint,
  MailrelayDeliverabilityReport,
  MailrelayCredentials,
  MailrelayCredentialsInput,
  MailrelayEmailTemplate,
  MailrelayEvent,
  MailrelayGroup,
  MailrelayOverview,
  MailrelayPagination,
  MailrelaySegment,
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
  const provider = raw.provider === "nrs360" ? "nrs360" : "mailrelay";
  return {
    senderId: String(raw.senderId ?? raw.defaultSenderId ?? (provider === "nrs360" ? "1" : "")),
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
    provider,
    fromEmail: String(raw.fromEmail ?? ""),
    fromName: String(raw.fromName ?? ""),
    replyTo: String(raw.replyTo ?? ""),
  };
}

function configPayload(config: MailrelayConfig) {
  return {
    enabled: config.enabled !== false,
    provider: config.provider ?? "mailrelay",
    defaultSenderId:
      config.provider === "nrs360"
        ? undefined
        : config.senderId
          ? Number(config.senderId)
          : undefined,
    defaultGroupIds: config.defaultGroupId ? [Number(config.defaultGroupId)] : [],
    tagGroupMappings: config.tagGroupMappings.map((mapping) => ({
      tag: mapping.tag,
      groupIds: mapping.groupId ? [Number(mapping.groupId)] : [],
    })),
    eventTypes: config.eventTypes ?? [],
    ...(config.fromEmail ? { fromEmail: config.fromEmail } : {}),
    ...(config.fromName !== undefined ? { fromName: config.fromName } : {}),
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
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

function ensureUnsubscribeHtml(html: string, provider: "mailrelay" | "nrs360" = "mailrelay"): string {
  const trimmed = html.trim();
  if (provider === "nrs360") {
    if (/\[unsubscribe_link\]/i.test(trimmed)) return trimmed;
    if (/unsubscribe_url|%UNSUBSCRIBE%/i.test(trimmed)) {
      return trimmed
        .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, "[unsubscribe_link]")
        .replace(/%UNSUBSCRIBE%/gi, "[unsubscribe_link]");
    }
    return `${trimmed}\n<p style="font-size:12px;color:#666;margin-top:24px;"><a href="[unsubscribe_link]">Unsubscribe</a></p>`;
  }
  if (/unsubscribe_url|%UNSUBSCRIBE%/i.test(trimmed)) return trimmed;
  return `${trimmed}\n<p style="font-size:12px;color:#666;margin-top:24px;"><a href="{{ unsubscribe_url }}">Unsubscribe</a></p>`;
}

function normalizeCampaign(value: unknown, defaultStatus: MailrelayCampaign["status"] = "draft") {
  const raw = record(value);
  const groupIds = Array.isArray(raw.groupIds)
    ? raw.groupIds
    : Array.isArray(raw.group_ids)
      ? raw.group_ids
      : [];
  const rawTarget = String(raw.target ?? (raw.segment_id || raw.segmentId ? "segment" : "groups"));
  const target = rawTarget === "segment" ? "segment" : "groups";
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
    target,
    groupIds: groupIds.map((id) => String(id)),
    segmentId: String(raw.segmentId ?? raw.segment_id ?? ""),
    campaignFolderId: String(raw.campaignFolderId ?? raw.campaign_folder_id ?? ""),
    replyTo: String(raw.replyTo ?? raw.reply_to ?? ""),
    analyticsUtmCampaign: String(
      raw.analyticsUtmCampaign ?? raw.analytics_utm_campaign ?? ""
    ),
    usePremailer: Boolean(raw.usePremailer ?? raw.use_premailer ?? false),
    trackOpens: Boolean(raw.trackOpens ?? raw.track_opens ?? true),
    trackClicks: Boolean(raw.trackClicks ?? raw.track_clicks ?? true),
    status,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ""),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ""),
    sentAt: raw.sentAt || raw.sent_at ? String(raw.sentAt ?? raw.sent_at) : undefined,
  } satisfies MailrelayCampaign;
}

function campaignPayload(
  payload: MailrelayCampaignInput,
  provider: "mailrelay" | "nrs360" = "mailrelay"
) {
  const body: Record<string, unknown> = {
    subject: payload.subject,
    ...(payload.name ? { name: payload.name } : {}),
    ...(payload.previewText ? { preview_text: payload.previewText } : {}),
    html: ensureUnsubscribeHtml(payload.html, provider),
    target: payload.target,
    track_opens: payload.trackOpens,
    track_clicks: payload.trackClicks,
  };
  if (provider !== "nrs360" && payload.senderId) {
    body.sender_id = Number(payload.senderId);
  }

  if (payload.target === "segment") {
    body.segment_id = Number(payload.segmentId);
  } else {
    body.group_ids = payload.groupIds.map(Number);
  }

  if (payload.campaignFolderId) {
    body.campaign_folder_id = Number(payload.campaignFolderId);
  }
  if (payload.replyTo) body.reply_to = payload.replyTo;
  if (payload.analyticsUtmCampaign) {
    body.analytics_utm_campaign = payload.analyticsUtmCampaign;
  }
  if (payload.usePremailer) body.use_premailer = true;

  return body;
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

export function useMailrelaySegments(enabled = true) {
  return useQuery<{ segments: MailrelaySegment[] }>({
    queryKey: [...key, "segments"],
    queryFn: async () => {
      const response = await api.get<{ segments: unknown[] }>("/email-marketing/segments");
      return {
        segments: response.segments.map((value) => {
          const segment = record(value);
          return {
            id: String(segment.id ?? ""),
            name: String(segment.name ?? segment.title ?? `Segment ${segment.id ?? ""}`),
          };
        }),
      };
    },
    enabled,
    retry: false,
  });
}

export function useMailrelayCampaignFolders(enabled = true) {
  return useQuery<{ folders: MailrelayCampaignFolder[] }>({
    queryKey: [...key, "campaign-folders"],
    queryFn: async () => {
      const response = await api.get<{ folders: unknown[] }>("/email-marketing/campaign-folders");
      return {
        folders: response.folders.map((value) => {
          const folder = record(value);
          return {
            id: String(folder.id ?? ""),
            name: String(folder.name ?? `Folder ${folder.id ?? ""}`),
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

function countMetric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeDeliverabilityCounts(
  value: unknown
): Omit<MailrelayCampaignMetrics, "campaignId"> {
  const metrics = record(value);
  const hardBounces = countMetric(metrics.hardBounces ?? metrics.hardBounced);
  const softBounces = countMetric(metrics.softBounces ?? metrics.softBounced);
  const storedBounces = countMetric(metrics.bounces ?? metrics.bounced);
  const genericSource = metrics.genericBounces ?? metrics.genericBounced;
  const genericBounces =
    genericSource == null
      ? Math.max(0, storedBounces - hardBounces - softBounces)
      : countMetric(genericSource);
  return {
    sent: countMetric(metrics.sent),
    delivered: countMetric(metrics.delivered),
    opens: countMetric(metrics.opens ?? metrics.opened),
    clicks: countMetric(metrics.clicks ?? metrics.clicked),
    hardBounces,
    softBounces,
    genericBounces,
    bounces: hardBounces + softBounces + genericBounces,
    unsubscribes: countMetric(metrics.unsubscribes ?? metrics.unsubscribed),
    complaints: countMetric(metrics.complaints ?? metrics.complained),
  };
}

function normalizeMetrics(value: unknown, campaignId: string): MailrelayCampaignMetrics {
  const metrics = record(value);
  return {
    campaignId: String(metrics.campaignId ?? campaignId),
    ...normalizeDeliverabilityCounts(value),
  };
}

function normalizeDailyPoint(value: unknown): MailrelayDeliverabilityDailyPoint {
  const point = record(value);
  return {
    date: String(point.date ?? ""),
    ...normalizeDeliverabilityCounts(value),
  };
}

function normalizeDeliverabilityCampaign(value: unknown): MailrelayDeliverabilityCampaign {
  const row = record(value);
  const daily = Array.isArray(row.daily) ? row.daily : [];
  return {
    ...normalizeMetrics(value, String(row.campaignId ?? "")),
    name: String(row.name ?? ""),
    daily: daily.map(normalizeDailyPoint),
  };
}

function normalizeDeliverabilityReport(value: unknown): MailrelayDeliverabilityReport {
  const report = record(value);
  const campaigns = Array.isArray(report.campaigns) ? report.campaigns : [];
  const daily = Array.isArray(report.daily) ? report.daily : [];
  return {
    from: typeof report.from === "string" ? report.from : null,
    to: typeof report.to === "string" ? report.to : null,
    totals: normalizeDeliverabilityCounts(report.totals),
    campaigns: campaigns.map(normalizeDeliverabilityCampaign),
    daily: daily.map(normalizeDailyPoint),
  };
}

function normalizePagination(value: unknown): MailrelayPagination {
  const raw = record(value);
  return {
    page: Number(raw.page ?? 1),
    perPage: Number(raw.perPage ?? raw.per_page ?? 20),
    hasMore: Boolean(raw.hasMore),
    ...(raw.totalPages != null ? { totalPages: Number(raw.totalPages) } : {}),
  };
}

export function useMailrelayCampaigns(
  enabled = true,
  options: { page?: number; perPage?: number } = {}
) {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;
  return useQuery<{ campaigns: MailrelayCampaign[]; pagination: MailrelayPagination }>({
    queryKey: [...key, "campaigns", page, perPage],
    queryFn: async () => {
      const response = await api.get<{ campaigns: unknown[]; pagination?: unknown }>(
        `/email-marketing/campaigns?page=${page}&per_page=${perPage}`
      );
      return {
        campaigns: response.campaigns.map((campaign) => normalizeCampaign(campaign)),
        pagination: normalizePagination(response.pagination),
      };
    },
    enabled,
  });
}

export function useCreateMailrelayCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      payload,
      provider = "mailrelay",
    }: {
      payload: MailrelayCampaignInput;
      provider?: "mailrelay" | "nrs360";
    }) => {
      const response = await api.post<{ campaign: unknown }>(
        "/email-marketing/campaigns",
        campaignPayload(payload, provider)
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
    mutationFn: async ({
      id,
      payload,
      provider = "mailrelay",
    }: {
      id: string;
      payload: MailrelayCampaignInput;
      provider?: "mailrelay" | "nrs360";
    }) => {
      const response = await api.put<{ campaign: unknown }>(
        `/email-marketing/campaigns/${id}`,
        campaignPayload(payload, provider)
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
    mutationFn: async ({
      campaign,
      scheduledAt,
    }: {
      campaign: Pick<MailrelayCampaign, "id" | "target" | "groupIds" | "segmentId">;
      scheduledAt?: string;
    }) => {
      const body: Record<string, unknown> = {
        target: campaign.target,
      };
      if (campaign.target === "segment") {
        body.segment_id = Number(campaign.segmentId);
      } else {
        body.group_ids = campaign.groupIds.map(Number);
      }
      if (scheduledAt) body.scheduled_at = scheduledAt;

      const response = await api.post<{ campaign: unknown }>(
        `/email-marketing/campaigns/${campaign.id}/send`,
        body
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

export function useMailrelayDeliverability(
  range: { from: string; to: string } | null,
  enabled = true
) {
  const params = new URLSearchParams();
  if (range) {
    params.set("from", range.from);
    params.set("to", range.to);
  }
  const query = params.toString();
  return useQuery<{ report: MailrelayDeliverabilityReport }>({
    queryKey: [...key, "deliverability", range?.from ?? "lifetime", range?.to ?? "lifetime"],
    queryFn: async () => {
      const response = await api.get<{ report: unknown }>(
        `/email-marketing/deliverability${query ? `?${query}` : ""}`
      );
      return { report: normalizeDeliverabilityReport(response.report) };
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
      return { metrics: normalizeMetrics(response.metrics, campaignId) };
    },
    enabled: Boolean(campaignId),
  });
}

export function useMailrelayOverview(enabled = true) {
  return useQuery<{ overview: MailrelayOverview }>({
    queryKey: [...key, "overview"],
    queryFn: () => api.get<{ overview: MailrelayOverview }>("/email-marketing/overview"),
    enabled,
  });
}

export function useMailrelayEvents(
  enabled = true,
  options: { campaignId?: string; limit?: number } = {}
) {
  const params = new URLSearchParams();
  if (options.campaignId) params.set("campaignId", options.campaignId);
  if (options.limit) params.set("limit", String(options.limit));
  const query = params.toString();
  return useQuery<{ events: MailrelayEvent[] }>({
    queryKey: [...key, "events", options.campaignId ?? "all", options.limit ?? 50],
    queryFn: async () => {
      const response = await api.get<{ events: unknown[] }>(
        `/email-marketing/events${query ? `?${query}` : ""}`
      );
      return {
        events: response.events.map((value) => {
          const event = record(value);
          const campaignId = event.campaignId;
          return {
            eventId: String(event.eventId ?? ""),
            type: String(event.type ?? ""),
            occurredAt: String(event.occurredAt ?? ""),
            ...(typeof event.email === "string" ? { email: event.email } : {}),
            ...(campaignId != null ? { campaignId: Number(campaignId) } : {}),
            ...(event.subscriberId != null ? { subscriberId: Number(event.subscriberId) } : {}),
          };
        }),
      };
    },
    enabled,
  });
}

export function useMailrelayTemplates(enabled = true) {
  return useQuery<{ templates: MailrelayEmailTemplate[] }>({
    queryKey: [...key, "templates"],
    queryFn: async () => {
      const response = await api.get<{ templates: unknown[] }>("/email-marketing/templates");
      return {
        templates: response.templates.map((value) => {
          const template = record(value);
          return {
            templateId: String(template.templateId ?? ""),
            name: String(template.name ?? ""),
            subject: String(template.subject ?? ""),
            html: String(template.html ?? ""),
            createdAt: String(template.createdAt ?? ""),
            updatedAt: String(template.updatedAt ?? ""),
            ...(template.previewText ? { previewText: String(template.previewText) } : {}),
          };
        }),
      };
    },
    enabled,
  });
}

export function useCreateMailrelayTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Pick<MailrelayEmailTemplate, "name" | "subject" | "previewText" | "html">) =>
      api.post<{ template: MailrelayEmailTemplate }>("/email-marketing/templates", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...key, "templates"] });
      void queryClient.invalidateQueries({ queryKey: [...key, "overview"] });
    },
  });
}

export function useDeleteMailrelayTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      api.delete(`/email-marketing/templates/${templateId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...key, "templates"] });
      void queryClient.invalidateQueries({ queryKey: [...key, "overview"] });
    },
  });
}
