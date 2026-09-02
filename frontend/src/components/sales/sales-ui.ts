import type { PipelineStage } from "@/types";

export function stageVariant(
  stage: PipelineStage
): "success" | "warning" | "danger" | "default" | "info" | "accent" {
  if (stage.outcome === "won") return "success";
  if (stage.outcome === "lost") return "danger";
  if (stage.key === "negotiation") return "info";
  if (stage.key === "quoted") return "warning";
  return "accent";
}

export function stageBarColor(stage: PipelineStage): string {
  if (stage.outcome === "won") return "bg-success";
  if (stage.outcome === "lost") return "bg-danger";
  if (stage.key === "negotiation") return "bg-info";
  if (stage.key === "quoted") return "bg-warning";
  return "bg-accent";
}

export function formatSalesMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function contactInitials(name?: string, title?: string): string {
  const source = name?.trim() || title?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
