import type { FlowNodeData } from "@/types";

export function resolveConfiguredWhatsAppChannelIds(
  data: Pick<FlowNodeData, "whatsappChannelId" | "whatsappChannelIds">
): string[] {
  const fromArray = (data.whatsappChannelIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }
  const legacy = data.whatsappChannelId?.trim();
  return legacy ? [legacy] : [];
}

export function buildWhatsAppChannelScopePatch(channelIds: string[]): {
  whatsappChannelId: undefined;
  whatsappChannelIds: string[] | undefined;
} {
  const unique = [...new Set(channelIds.map((id) => id.trim()).filter(Boolean))];
  return {
    whatsappChannelId: undefined,
    whatsappChannelIds: unique.length > 0 ? unique : undefined,
  };
}
