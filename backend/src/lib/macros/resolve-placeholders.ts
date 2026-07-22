export interface MacroPlaceholderContext {
  contactName?: string;
  phoneNumber?: string;
  advisorName?: string;
}

const PLACEHOLDER_MAP: Record<string, keyof MacroPlaceholderContext> = {
  nombre: "contactName",
  name: "contactName",
  telefono: "phoneNumber",
  phone: "phoneNumber",
  asesor: "advisorName",
  advisor: "advisorName",
};

export function resolvePlaceholders(
  content: string,
  context: MacroPlaceholderContext
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const field = PLACEHOLDER_MAP[key.toLowerCase()];
    if (!field) return match;

    if (field === "contactName") {
      const value = context.contactName?.trim() || context.phoneNumber?.trim();
      return value || match;
    }

    const value = context[field];
    if (!value) return match;

    return value;
  });
}
