export type BotLocale = "es" | "en";

export type LocalizedText = string | Record<BotLocale, string>;

export function isLocalizedObject(
  value: LocalizedText | undefined
): value is Record<BotLocale, string> {
  return typeof value === "object" && value !== null && ("es" in value || "en" in value);
}
