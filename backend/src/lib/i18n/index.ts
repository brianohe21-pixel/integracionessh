export type { BotLocale, LocalizedText } from "./types.js";
export { isLocalizedObject } from "./types.js";
export { detectLocale, resolveConversationLocale } from "./detect-locale.js";
export {
  resolveLocalizedText,
  templateLanguageForLocale,
  intlLocaleForBot,
  getBotLocale,
} from "./resolve-localized.js";
export { getSystemMessage, type SystemMessageKey } from "./messages.js";
