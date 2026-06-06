import { listEnabledAutomationsForBot } from "../dynamodb/automation.repository.js";
import type { AutomationRule, AutomationTrigger, Conversation } from "../../types/index.js";

export function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function matchesKeyword(rule: AutomationRule, text: string): boolean {
  if (!rule.keywords?.length) return false;
  const normalized = normalizeText(text);
  const mode = rule.matchMode ?? "contains";

  return rule.keywords.some((kw) => {
    const nkw = normalizeText(kw);
    if (mode === "exact") return normalized === nkw;
    return normalized.includes(nkw);
  });
}

export async function evaluateAutomations(params: {
  tenantId: string;
  botId: string;
  triggers: AutomationTrigger[];
  text: string;
  conversation: Conversation;
  isNewConversation: boolean;
}): Promise<AutomationRule | null> {
  const rules = await listEnabledAutomationsForBot(params.tenantId, params.botId);
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (!params.triggers.includes(rule.trigger)) continue;

    if (rule.trigger === "first_message") {
      if (!params.isNewConversation || params.conversation.welcomeSentAt) continue;
      return rule;
    }

    if (rule.trigger === "keyword") {
      if (matchesKeyword(rule, params.text)) return rule;
    }
  }

  return null;
}
