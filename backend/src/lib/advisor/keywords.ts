const HANDOFF_KEYWORDS = [
  "asesor",
  "asesora",
  "hablar con alguien",
  "hablar con una persona",
  "quiero un asesor",
  "necesito un asesor",
  "hablar con agente",
  "agente",
  "persona real",
  "operador",
  "representante",
  "talk to a person",
  "speak to someone",
  "speak to an agent",
  "agent",
];

export function messageRequestsHandoff(text: string): boolean {
  const normalized = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  return HANDOFF_KEYWORDS.some((kw) => normalized.includes(kw));
}
