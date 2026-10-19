import type { FlowNodeData } from "../../types/index.js";

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

export function matchesWhatsAppChannelFilter(
  data: Pick<FlowNodeData, "whatsappChannelId" | "whatsappChannelIds">,
  conversationWhatsAppChannelId: string | undefined
): boolean {
  const allowed = resolveConfiguredWhatsAppChannelIds(data);
  if (allowed.length === 0) return true;
  if (!conversationWhatsAppChannelId?.trim()) return false;
  return allowed.includes(conversationWhatsAppChannelId.trim());
}
