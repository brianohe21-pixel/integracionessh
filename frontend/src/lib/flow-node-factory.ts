import type { FlowNode, FlowNodeData, FlowNodeType } from "@/types";

export const FLOW_NODE_DRAG_MIME = "application/flow-node-type";

export type FlowBindingPreset = "messaging" | "form";

export function buildDefaultNodeData(
  type: FlowNodeType,
  label: string,
  suggestedBotId?: string,
  bindingPreset: FlowBindingPreset = "form"
): FlowNodeData {
  const defaultData: FlowNodeData = { label };
  const messaging = bindingPreset === "messaging";

  if (type === "message") defaultData.messageText = "";
  if (type === "buttons") {
    defaultData.messageText = "";
    defaultData.buttons = [{ id: "btn-1", title: "" }];
  }
  if (type === "delay") defaultData.delaySeconds = 5;
  if (type === "condition") {
    defaultData.conditionVariable = "form.phone";
    defaultData.conditionOperator = "contains";
  }
  if (type === "save_contact") {
    defaultData.contactPhoneBinding = "{{form.phone}}";
  }
  if (type === "create_lead") {
    defaultData.leadPhoneBinding = "{{form.phone}}";
    defaultData.leadNameBinding = "{{form.name}}";
  }
  if (type === "create_opportunity") {
    defaultData.opportunityTitleBinding = messaging
      ? "{{contact_name}}"
      : "{{form.title}}";
    defaultData.opportunityPhoneBinding = messaging ? "{{phone}}" : "{{form.phone}}";
    defaultData.opportunityNameBinding = messaging ? "{{contact_name}}" : "{{form.name}}";
    defaultData.opportunityCurrency = "USD";
    defaultData.opportunityStage = "new";
  }
  if (type === "send_notification") {
    defaultData.notificationChannel = "whatsapp";
    defaultData.notificationMessageType = "text";
    defaultData.notificationRecipientBinding = "{{form.phone}}";
    defaultData.notificationMessageText = "";
  }
  if (type === "send_otp") {
    defaultData.otpMessageText = "Tu codigo de verificacion es {{code}}. Expira en 5 minutos.";
    defaultData.otpMaxAttempts = 3;
  }
  if (type === "send_audio") {
    defaultData.audioMimeType = "audio/ogg";
  }
  if (type === "agent") {
    defaultData.channel = "any";
    if (suggestedBotId?.trim()) defaultData.botId = suggestedBotId.trim();
  }

  return defaultData;
}

export function createFlowNode(params: {
  type: FlowNodeType;
  position: { x: number; y: number };
  label: string;
  suggestedBotId?: string;
  bindingPreset?: FlowBindingPreset;
}): FlowNode {
  return {
    id: `${params.type}-${Date.now()}`,
    type: params.type,
    position: params.position,
    data: buildDefaultNodeData(
      params.type,
      params.label,
      params.suggestedBotId,
      params.bindingPreset
    ),
  };
}

export function defaultPalettePosition(nodeCount: number): { x: number; y: number } {
  return {
    x: 220 + (nodeCount % 3) * 48,
    y: 60 + Math.floor(nodeCount / 3) * 150,
  };
}
