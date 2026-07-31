import type { BotLocale } from "./types.js";

const SPANISH_MARKERS =
  /\b(hola|gracias|por favor|buenos días|buenas tardes|buenas noches|qué|cómo|dónde|cuándo|cuánto|necesito|quiero|puedo|tengo|estoy|usted|ustedes|también|información|ayuda|precio|pedido|cita|agendar)\b|¿|ñ|á|é|í|ó|ú/i;

const ENGLISH_MARKERS =
  /\b(hello|hi|thanks|thank you|please|what|how|where|when|need|want|can i|i have|i am|you|also|information|help|price|order|appointment|schedule)\b/i;

const SHORT_AMBIGUOUS = /^(ok|okay|si|sí|no|yes|y|n|k|👍|👋)$/i;

export function detectLocale(text: string, fallback: BotLocale = "es"): BotLocale {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  if (SHORT_AMBIGUOUS.test(trimmed)) return fallback;

  const spanishScore = (trimmed.match(SPANISH_MARKERS) ?? []).length;
  const englishScore = (trimmed.match(ENGLISH_MARKERS) ?? []).length;

  if (/[ñáéíóú¿¡]/i.test(trimmed)) return "es";
  if (spanishScore > englishScore) return "es";
  if (englishScore > spanishScore) return "en";

  const words = trimmed.split(/\s+/);
  if (words.length <= 2) return fallback;

  return fallback;
}

export function resolveConversationLocale(params: {
  userMessage: string;
  conversationLocale?: BotLocale | undefined;
  botDefaultLocale?: BotLocale | undefined;
}): BotLocale {
  const fallback = params.conversationLocale ?? params.botDefaultLocale ?? "es";
  return detectLocale(params.userMessage, fallback);
}
