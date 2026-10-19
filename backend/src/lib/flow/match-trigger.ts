import type {
  Conversation,
  FlowDefinition,
  FlowNode,
  InboundNormalized,
} from "../../types/index.js";
import { normalizeText } from "../automation/evaluate.js";
import { getFlowEntryNode } from "./entry-node.js";
import { matchesWhatsAppChannelFilter } from "./whatsapp-channel-filter.js";

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

function matchesChannelConfig(
  node: FlowNode | undefined,
  conversation: Conversation
): boolean | null {
  if (!node) return null;
  const channel = node.data.channel ?? "any";
  if (channel === "any") return true;

  const conversationChannel = conversation.channel ?? "whatsapp";
  if (conversationChannel !== channel) return false;

  if (channel === "whatsapp") {
    return matchesWhatsAppChannelFilter(node.data, conversation.whatsappChannelId);
  }

  return true;
}

function matchesFlowChannel(flow: FlowDefinition, conversation: Conversation): boolean {
  const entry = getFlowEntryNode(flow.nodes);
  if (entry?.type === "message_received_trigger") {
    return matchesChannelConfig(entry, conversation) ?? true;
  }

  const agentNode = flow.nodes.find((node) => node.type === "agent");
  const agentMatch = matchesChannelConfig(agentNode, conversation);
  if (agentMatch !== null) return agentMatch;

  return matchesChannelConfig(entry, conversation) ?? true;
}

export function findTriggerFlow(
  flows: FlowDefinition[],
  inbound: InboundNormalized,
  conversation: Conversation,
  isNewConversation: boolean
): FlowDefinition | null {
  const enabled = flows.filter((f) => f.enabled);
  for (const flow of enabled) {
    const triggerNode = getFlowEntryNode(flow.nodes);
    if (!triggerNode) continue;
    if (!matchesFlowChannel(flow, conversation)) continue;

    const triggerType = triggerNode.data.triggerType ?? "any_message";
    if (
      triggerNode.type === "opportunity_stage_trigger" ||
      triggerType === "opportunity_stage_entered" ||
      triggerType === "web_form_submitted" ||
      triggerType === "voice_call"
    ) {
      continue;
    }

    if (triggerNode.type === "trigger") {
      if (inbound.text.trim()) return flow;
      continue;
    }

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
