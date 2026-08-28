import { formatDateUtc, resolveMetricsDateRange } from "./call-metrics.js";
import type {
  WebsiteMetrics,
  WebsiteMetricsBotRow,
  WebsiteMetricsDailyRow,
  WebsiteMetricsSummary,
  WebsiteMetricsTopRow,
} from "../../types/index.js";

export interface WebsiteDailyAggregate {
  date: string;
  pageviews: number;
  uniqueVisitors: number;
  sessions: number;
  byBot: Record<string, number>;
  paths: Record<string, number>;
  pathLabels: Record<string, string>;
  referrers: Record<string, number>;
  referrerLabels: Record<string, string>;
}

function shiftDateUtc(dateStr: string, dayDelta: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + dayDelta);
  return formatDateUtc(date);
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = shiftDateUtc(current, 1);
  }
  return dates;
}

function topRows(
  counts: Record<string, number>,
  labels: Record<string, string>,
  limit = 8
): WebsiteMetricsTopRow[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      label: labels[key] ?? key,
      count,
    }));
}

export function buildWebsiteMetrics(
  dailyRows: WebsiteDailyAggregate[],
  range: { from: string; to: string },
  botNames: Map<string, string>,
  botId?: string
): WebsiteMetrics {
  const scopedRows = botId
    ? dailyRows.map((row) => ({
        ...row,
        pageviews: row.byBot[botId] ?? 0,
      }))
    : dailyRows;

  const summary: WebsiteMetricsSummary = scopedRows.reduce(
    (acc, row) => ({
      pageviews: acc.pageviews + row.pageviews,
      uniqueVisitors: acc.uniqueVisitors + row.uniqueVisitors,
      sessions: acc.sessions + row.sessions,
    }),
    { pageviews: 0, uniqueVisitors: 0, sessions: 0 }
  );

  const pathCounts: Record<string, number> = {};
  const pathLabels: Record<string, string> = {};
  const referrerCounts: Record<string, number> = {};
  const referrerLabels: Record<string, string> = {};
  const botCounts: Record<string, number> = {};

  for (const row of dailyRows) {
    for (const [key, count] of Object.entries(row.paths)) {
      pathCounts[key] = (pathCounts[key] ?? 0) + count;
      pathLabels[key] = row.pathLabels[key] ?? pathLabels[key] ?? key;
    }
    for (const [key, count] of Object.entries(row.referrers)) {
      referrerCounts[key] = (referrerCounts[key] ?? 0) + count;
      referrerLabels[key] = row.referrerLabels[key] ?? referrerLabels[key] ?? key;
    }
    for (const [id, count] of Object.entries(row.byBot)) {
      if (botId && id !== botId) continue;
      botCounts[id] = (botCounts[id] ?? 0) + count;
    }
  }

  const byBot: WebsiteMetricsBotRow[] = Object.entries(botCounts)
    .map(([id, pageviews]) => ({
      botId: id,
      botName: botNames.get(id) ?? id,
      pageviews,
    }))
    .sort((a, b) => b.pageviews - a.pageviews);

  const dailyTrend: WebsiteMetricsDailyRow[] = enumerateDates(range.from, range.to).map((date) => {
    const row = scopedRows.find((item) => item.date === date);
    return {
      date,
      pageviews: row?.pageviews ?? 0,
      uniqueVisitors: row?.uniqueVisitors ?? 0,
      sessions: row?.sessions ?? 0,
    };
  });

  const windowDays = enumerateDates(range.from, range.to).length;

  return {
    from: range.from,
    to: range.to,
    windowDays,
    summary,
    dailyTrend,
    topPages: topRows(pathCounts, pathLabels),
    topReferrers: topRows(referrerCounts, referrerLabels),
    byBot,
  };
}

export function resolveWebsiteMetricsDateRange(input: {
  from?: string;
  to?: string;
  days?: number;
}): { from: string; to: string } {
  return resolveMetricsDateRange(input);
}
