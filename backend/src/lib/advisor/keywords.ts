const HANDOFF_KEYWORDS = [
  "asesor",
  "asesora",
  "hablar con humano",
  "hablar con una persona",
  "quiero un asesor",
  "necesito un asesor",
  "asesor humano",
  "agente humano",
  "persona real",
  "operador",
  "representante",
  "talk to a human",
  "human agent",
  "speak to someone",
  "agent",
];

export function messageRequestsHandoff(text: string): boolean {
  const normalized = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  return HANDOFF_KEYWORDS.some((kw) => normalized.includes(kw));
}
