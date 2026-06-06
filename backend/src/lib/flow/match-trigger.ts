import type { Conversation, FlowDefinition, InboundNormalized } from "../../types/index.js";
import { normalizeText } from "../automation/evaluate.js";

function matchesKeyword(
  text: string,
  keywords: string[] | undefined,
  matchMode: "contains" | "exact" | undefined
): boolean {
  if (!keywords?.length) return false;
  const normalized = normalizeText(text);
  const mode = matchMode ?? "contains";
  return keywords.some((kw) => {
    const n = normalizeText(kw);
    return mode === "exact" ? normalized === n : normalized.includes(n);
  });
}

export function findTriggerFlow(
  flows: FlowDefinition[],
  inbound: InboundNormalized,
  conversation: Conversation,
  isNewConversation: boolean
): FlowDefinition | null {
  const enabled = flows.filter((f) => f.enabled);
  for (const flow of enabled) {
    const triggerNode = flow.nodes.find((n) => n.type === "trigger");
    if (!triggerNode) continue;
    const triggerType = triggerNode.data.triggerType ?? "any_message";

    if (triggerType === "first_message") {
      if (!isNewConversation || conversation.welcomeSentAt) continue;
      return flow;
    }

    if (triggerType === "keyword") {
      if (!matchesKeyword(inbound.text, triggerNode.data.keywords, triggerNode.data.matchMode)) {
        continue;
      }
      return flow;
    }

    if (triggerType === "any_message") {
      if (inbound.text.trim()) return flow;
    }
  }
  return null;
}
