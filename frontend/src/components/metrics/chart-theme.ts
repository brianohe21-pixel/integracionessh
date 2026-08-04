export const METRICS_CHART_COLORS = [
  "#128c7e",
  "#2dd4bf",
  "#0f766e",
  "#14b8a6",
  "#0d9488",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
];

export const METRICS_FUNNEL_COLORS = ["#94a3b8", "#3b82f6", "#16a34a", "#128c7e"];

export const metricsTooltipStyle = {
  background: "var(--surface-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
};

export const metricsAxisTick = { fontSize: 11, fill: "var(--text-secondary)" };

function truncateLabel(value: string, max = 14): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function chartBotLabel(name: string, max = 14): { name: string; fullName: string } {
  return { name: truncateLabel(name, max), fullName: name };
}
