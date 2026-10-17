import type { AiMessagePack } from "../../types/index.js";

export const DEFAULT_AI_MESSAGE_PACKS: AiMessagePack[] = [
  { id: "pack_500", messages: 500, priceCents: 3_000_000, active: true },
  { id: "pack_2000", messages: 2_000, priceCents: 10_000_000, active: true },
  { id: "pack_5000", messages: 5_000, priceCents: 22_000_000, active: true },
];

export function normalizeAiMessagePacks(value: unknown): AiMessagePack[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_AI_MESSAGE_PACKS.map((pack) => ({ ...pack }));
  }

  const packs: AiMessagePack[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const messages =
      typeof raw.messages === "number" && Number.isFinite(raw.messages)
        ? Math.floor(raw.messages)
        : 0;
    const priceCents =
      typeof raw.priceCents === "number" && Number.isFinite(raw.priceCents)
        ? Math.floor(raw.priceCents)
        : -1;
    if (!id || seen.has(id) || messages <= 0 || priceCents < 0) continue;
    seen.add(id);
    packs.push({
      id,
      messages,
      priceCents,
      active: raw.active === false ? false : true,
    });
  }

  return packs.length > 0
    ? packs
    : DEFAULT_AI_MESSAGE_PACKS.map((pack) => ({ ...pack }));
}
