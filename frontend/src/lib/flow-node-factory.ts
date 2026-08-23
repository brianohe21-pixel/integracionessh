import type { FlowNode, FlowNodeData, FlowNodeType } from "@/types";

export const FLOW_NODE_DRAG_MIME = "application/flow-node-type";

export function buildDefaultNodeData(
  type: FlowNodeType,
  label: string,
  suggestedBotId?: string
): FlowNodeData {
  const defaultData: FlowNodeData = { label };

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
    defaultData.opportunityTitleBinding = "{{form.title}}";
    defaultData.opportunityPhoneBinding = "{{form.phone}}";
    defaultData.opportunityNameBinding = "{{form.name}}";
    defaultData.opportunityCurrency = "USD";
    defaultData.opportunityStage = "new";
  }
  if (type === "send_notification") {
    defaultData.notificationChannel = "whatsapp";
    defaultData.notificationMessageType = "text";
    defaultData.notificationRecipientBinding = "{{form.phone}}";
    defaultData.notificationMessageText = "";
  }
  if (type === "assign_bot" && suggestedBotId) {
    defaultData.botId = suggestedBotId;
  }

  return defaultData;
}

export function createFlowNode(params: {
  type: FlowNodeType;
  position: { x: number; y: number };
  label: string;
  suggestedBotId?: string;
}): FlowNode {
  return {
    id: `${params.type}-${Date.now()}`,
    type: params.type,
    position: params.position,
    data: buildDefaultNodeData(params.type, params.label, params.suggestedBotId),
  };
}

export function defaultPalettePosition(nodeCount: number): { x: number; y: number } {
  return {
    x: 220 + (nodeCount % 3) * 48,
    y: 60 + Math.floor(nodeCount / 3) * 150,
  };
}
