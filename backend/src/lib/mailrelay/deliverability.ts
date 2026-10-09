import type { MailrelayCampaignMetrics, MailrelayCampaignRecord } from "../../types/index.js";
import {
  bounceKindForStoredMailrelayEvent,
  metricForMailrelayEvent,
} from "./webhook.js";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;

export interface MailrelayDeliverabilityCounts {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  hardBounced: number;
  softBounced: number;
  genericBounced: number;
  unsubscribed: number;
  complained: number;
}

export interface MailrelayDeliverabilityDailyPoint extends MailrelayDeliverabilityCounts {
  date: string;
}

export interface MailrelayDeliverabilityCampaignRow extends MailrelayDeliverabilityCounts {
  campaignId: number;
  name: string;
  daily: MailrelayDeliverabilityDailyPoint[];
}

export interface MailrelayDeliverabilityReport {
  from: string | null;
  to: string | null;
  totals: MailrelayDeliverabilityCounts;
  campaigns: MailrelayDeliverabilityCampaignRow[];
  daily: MailrelayDeliverabilityDailyPoint[];
}

export type MailrelayDeliverabilityRange =
  | { ok: true; from: string; to: string }
  | { ok: false; message: string };

interface MutableCounts {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  hardBounced: number;
  softBounced: number;
  unsubscribed: number;
  complained: number;
}

export interface MailrelayDeliverabilityEvent {
  type: string;
  occurredAt: string;
  campaignId?: number;
  bounceKind?: string;
}

function nonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function emptyMutable(): MutableCounts {
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    hardBounced: 0,
    softBounced: 0,
    unsubscribed: 0,
    complained: 0,
  };
}

export function presentMailrelayBounceCounts(input: {
  bounced?: number;
  hardBounced?: number;
  softBounced?: number;
}): Pick<
  MailrelayDeliverabilityCounts,
  "bounced" | "hardBounced" | "softBounced" | "genericBounced"
> {
  const hardBounced = nonNegative(input.hardBounced);
  const softBounced = nonNegative(input.softBounced);
  const stored = nonNegative(input.bounced);
  const genericBounced = Math.max(0, stored - hardBounced - softBounced);
  return {
    hardBounced,
    softBounced,
    genericBounced,
    bounced: hardBounced + softBounced + genericBounced,
  };
}

export function normalizeStoredMailrelayMetrics(
  metrics: Partial<MailrelayCampaignMetrics> &
    Pick<MailrelayCampaignMetrics, "tenantId" | "campaignId" | "updatedAt">
): MailrelayCampaignMetrics {
  const bounce = presentMailrelayBounceCounts(metrics);
  return {
    tenantId: metrics.tenantId,
    campaignId: metrics.campaignId,
    sent: nonNegative(metrics.sent),
    delivered: nonNegative(metrics.delivered),
    opened: nonNegative(metrics.opened),
    clicked: nonNegative(metrics.clicked),
    unsubscribed: nonNegative(metrics.unsubscribed),
    complained: nonNegative(metrics.complained),
    updatedAt: metrics.updatedAt,
    ...bounce,
  };
}

export function mailrelayCampaignDisplayName(
  record: Pick<MailrelayCampaignRecord, "campaignId" | "subject" | "remote">
): string {
  const candidates = [record.remote.name, record.remote.subject, record.subject];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return `#${record.campaignId}`;
}

export function parseMailrelayDeliverabilityRange(
  from: string,
  to: string
): MailrelayDeliverabilityRange {
  if (!DATE_ONLY.test(from) || !DATE_ONLY.test(to)) {
    return { ok: false, message: "Invalid date range" };
  }
  const startMs = Date.parse(`${from}T00:00:00.000Z`);
  const endMs = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { ok: false, message: "Invalid date range" };
  }
  const nextFrom = from <= to ? from : to;
  const nextTo = from <= to ? to : from;
  const days =
    Math.floor(
      (Date.parse(`${nextTo}T00:00:00.000Z`) - Date.parse(`${nextFrom}T00:00:00.000Z`)) /
        86_400_000
    ) + 1;
  if (days > MAX_RANGE_DAYS) {
    return { ok: false, message: "Date range cannot exceed 90 days" };
  }
  return { ok: true, from: nextFrom, to: nextTo };
}

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function finalize(counts: MutableCounts): MailrelayDeliverabilityCounts {
  const bounce = presentMailrelayBounceCounts(counts);
  return {
    sent: counts.sent,
    delivered: counts.delivered,
    opened: counts.opened,
    clicked: counts.clicked,
    unsubscribed: counts.unsubscribed,
    complained: counts.complained,
    ...bounce,
  };
}

function applyEvent(target: MutableCounts, event: MailrelayDeliverabilityEvent): void {
  const kind = bounceKindForStoredMailrelayEvent(event);
  if (kind === "hard") {
    target.hardBounced += 1;
    target.bounced += 1;
    return;
  }
  if (kind === "soft") {
    target.softBounced += 1;
    target.bounced += 1;
    return;
  }
  if (kind === "generic") {
    target.bounced += 1;
    return;
  }
  const metric = metricForMailrelayEvent(event.type);
  if (metric === "sent") target.sent += 1;
  else if (metric === "delivered") target.delivered += 1;
  else if (metric === "opened") target.opened += 1;
  else if (metric === "clicked") target.clicked += 1;
  else if (metric === "unsubscribed") target.unsubscribed += 1;
  else if (metric === "complained") target.complained += 1;
}

function sumCounts(rows: MailrelayDeliverabilityCounts[]): MailrelayDeliverabilityCounts {
  const totals = emptyMutable();
  for (const row of rows) {
    totals.sent += row.sent;
    totals.delivered += row.delivered;
    totals.opened += row.opened;
    totals.clicked += row.clicked;
    totals.bounced += row.bounced;
    totals.hardBounced += row.hardBounced;
    totals.softBounced += row.softBounced;
    totals.unsubscribed += row.unsubscribed;
    totals.complained += row.complained;
  }
  return finalize(totals);
}

function dailySeries(
  from: string,
  to: string,
  buckets: Map<string, MutableCounts>
): MailrelayDeliverabilityDailyPoint[] {
  return eachDate(from, to).map((date) => ({
    date,
    ...finalize(buckets.get(date) ?? emptyMutable()),
  }));
}

export function buildMailrelayDeliverabilityReport(input: {
  from: string;
  to: string;
  events: MailrelayDeliverabilityEvent[];
  names?: Map<number, string>;
}): MailrelayDeliverabilityReport {
  const campaigns = new Map<number, { counts: MutableCounts; daily: Map<string, MutableCounts> }>();
  const overallDaily = new Map<string, MutableCounts>();

  for (const event of input.events) {
    if (!event.campaignId) continue;
    const date = event.occurredAt.slice(0, 10);
    if (date < input.from || date > input.to) continue;
    const bucket = campaigns.get(event.campaignId) ?? {
      counts: emptyMutable(),
      daily: new Map<string, MutableCounts>(),
    };
    const day = bucket.daily.get(date) ?? emptyMutable();
    const overall = overallDaily.get(date) ?? emptyMutable();
    applyEvent(bucket.counts, event);
    applyEvent(day, event);
    applyEvent(overall, event);
    bucket.daily.set(date, day);
    overallDaily.set(date, overall);
    campaigns.set(event.campaignId, bucket);
  }

  const rows: MailrelayDeliverabilityCampaignRow[] = [...campaigns.entries()]
    .map(([campaignId, bucket]) => ({
      campaignId,
      name: input.names?.get(campaignId) ?? `#${campaignId}`,
      ...finalize(bucket.counts),
      daily: dailySeries(input.from, input.to, bucket.daily),
    }))
    .sort((left, right) => right.sent - left.sent || left.campaignId - right.campaignId);

  return {
    from: input.from,
    to: input.to,
    totals: sumCounts(rows),
    campaigns: rows,
    daily: dailySeries(input.from, input.to, overallDaily),
  };
}

export function buildMailrelayDeliverabilityFromMetrics(input: {
  metrics: MailrelayCampaignMetrics[];
  names?: Map<number, string>;
}): MailrelayDeliverabilityReport {
  const rows: MailrelayDeliverabilityCampaignRow[] = input.metrics
    .map((metrics) => {
      const normalized = normalizeStoredMailrelayMetrics(metrics);
      return {
        campaignId: normalized.campaignId,
        name: input.names?.get(normalized.campaignId) ?? `#${normalized.campaignId}`,
        sent: normalized.sent,
        delivered: normalized.delivered,
        opened: normalized.opened,
        clicked: normalized.clicked,
        bounced: normalized.bounced,
        hardBounced: normalized.hardBounced,
        softBounced: normalized.softBounced,
        genericBounced: normalized.genericBounced,
        unsubscribed: normalized.unsubscribed,
        complained: normalized.complained,
        daily: [],
      };
    })
    .sort((left, right) => right.sent - left.sent || left.campaignId - right.campaignId);

  return {
    from: null,
    to: null,
    totals: sumCounts(rows),
    campaigns: rows,
    daily: [],
  };
}
