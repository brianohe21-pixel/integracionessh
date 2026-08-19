import type { CallEvent } from "@/types";
import { formatLatencyMs } from "@/lib/voice-agent-call-latency";

export type CallToolLatencyEntry = {
  toolName: string;
  latencyMs: number;
  success: boolean;
  statusCode?: number;
  error?: string;
  createdAt: string;
};

export type CallToolLatencySummary = {
  entries: CallToolLatencyEntry[];
  avgLatencyMs: number | null;
  maxLatencyMs: number | null;
  successCount: number;
  failureCount: number;
  byTool: Array<{
    toolName: string;
    count: number;
    avgLatencyMs: number;
    maxLatencyMs: number;
    successCount: number;
    failureCount: number;
  }>;
};

function readMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readMetadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readMetadataBoolean(metadata: Record<string, unknown>, key: string): boolean | undefined {
  const value = metadata[key];
  return typeof value === "boolean" ? value : undefined;
}

export function buildCallToolLatencySummary(events: CallEvent[]): CallToolLatencySummary {
  const entries = events
    .filter((event) => event.type === "tool_executed")
    .map((event) => {
      const metadata = event.metadata ?? {};
      const toolName =
        readMetadataString(metadata, "toolName") ?? event.message?.trim() ?? "tool";
      const latencyMs = readMetadataNumber(metadata, "latencyMs") ?? 0;
      const success = readMetadataBoolean(metadata, "success") ?? false;
      const statusCode = readMetadataNumber(metadata, "statusCode");
      const error = readMetadataString(metadata, "error");

      return {
        toolName,
        latencyMs,
        success,
        ...(statusCode !== undefined ? { statusCode } : {}),
        ...(error ? { error } : {}),
        createdAt: event.createdAt,
      };
    })
    .filter((entry) => entry.latencyMs > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const latencies = entries.map((entry) => entry.latencyMs);
  const byToolMap = new Map<
    string,
    { count: number; totalMs: number; maxMs: number; successCount: number; failureCount: number }
  >();

  for (const entry of entries) {
    const current = byToolMap.get(entry.toolName) ?? {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      successCount: 0,
      failureCount: 0,
    };
    current.count += 1;
    current.totalMs += entry.latencyMs;
    current.maxMs = Math.max(current.maxMs, entry.latencyMs);
    if (entry.success) current.successCount += 1;
    else current.failureCount += 1;
    byToolMap.set(entry.toolName, current);
  }

  const byTool = [...byToolMap.entries()]
    .map(([toolName, stats]) => ({
      toolName,
      count: stats.count,
      avgLatencyMs: stats.totalMs / stats.count,
      maxLatencyMs: stats.maxMs,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
    }))
    .sort((a, b) => b.avgLatencyMs - a.avgLatencyMs);

  return {
    entries,
    avgLatencyMs:
      latencies.length > 0
        ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
        : null,
    maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : null,
    successCount: entries.filter((entry) => entry.success).length,
    failureCount: entries.filter((entry) => !entry.success).length,
    byTool,
  };
}

export function buildToolLatencyBarPoints(entries: CallToolLatencyEntry[]) {
  return entries.map((entry, index) => ({
    key: `${entry.createdAt}-${index}`,
    label: `${index + 1}`,
    value: entry.latencyMs,
    color: entry.success ? "#22c55e" : "#ef4444",
  }));
}

export function formatToolLatencyDetail(entry: CallToolLatencyEntry): string {
  const parts = [formatLatencyMs(entry.latencyMs)];
  if (entry.statusCode !== undefined) parts.push(`HTTP ${entry.statusCode}`);
  if (entry.error) parts.push(entry.error);
  return parts.join(" · ");
}
