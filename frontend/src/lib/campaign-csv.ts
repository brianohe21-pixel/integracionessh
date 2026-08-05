import type { Campaign } from "@/types";

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "campaign";
}

export function buildCampaignExportFilename(campaign: Campaign): string {
  const channel = campaign.channel ?? "whatsapp";
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugifyName(campaign.name);
  return `campaign-${channel}-${slug}-${date}.csv`;
}
