import type { FlowEdge, FlowNode, FlowNodeData, FlowNodeType, FlowTriggerType, LocalizedText } from "@/types";

const CENTER_X = 400;
const ROW_HEIGHT = 140;

function pos(x: number, y: number) {
  return { x, y };
}

export function bilingual(es: string, en: string): LocalizedText {
  return { es, en };
}

export function node(
  id: string,
  type: FlowNodeType,
  data: FlowNodeData,
  x: number,
  y: number
): FlowNode {
  return { id, type, position: pos(x, y), data };
}

export function edge(
  id: string,
  source: string,
  target: string,
  sourceHandle?: string
): FlowEdge {
  return { id, source, target, ...(sourceHandle ? { sourceHandle } : {}) };
}

export function triggerNode(
  id: string,
  triggerType: FlowTriggerType,
  label: string,
  y = 40
): FlowNode {
  return node(id, "trigger", { label, triggerType }, CENTER_X, y);
}

export function messageNode(
  id: string,
  messageText: LocalizedText,
  label: string,
  x = CENTER_X,
  y: number
): FlowNode {
  return node(id, "message", { label, messageText }, x, y);
}

export function buttonsNode(
  id: string,
  messageText: LocalizedText,
  buttons: Array<{ id: string; title: LocalizedText }>,
  label: string,
  y: number
): FlowNode {
  return node(id, "buttons", { label, messageText, buttons }, CENTER_X, y);
}

export function endNode(id: string, label: string, x: number, y: number): FlowNode {
  return node(id, "end", { label, haltPipeline: true }, x, y);
}

export function handoffNode(id: string, label: string, x: number, y: number): FlowNode {
  return node(id, "handoff", { label }, x, y);
}

export function bookAppointmentNode(
  id: string,
  confirmationMessage: LocalizedText,
  label: string,
  x: number,
  y: number
): FlowNode {
  return node(id, "book_appointment", { label, confirmationMessage, maxDaysToShow: 14 }, x, y);
}

export function sendCatalogNode(
  id: string,
  catalogMessageText: LocalizedText,
  label: string,
  x: number,
  y: number
): FlowNode {
  return node(id, "send_catalog", { label, catalogMessageText }, x, y);
}

export function awaitOrderNode(
  id: string,
  messageText: LocalizedText,
  orderConfirmationMessage: LocalizedText,
  label: string,
  x: number,
  y: number
): FlowNode {
  return node(
    id,
    "await_order",
    { label, messageText, orderConfirmationMessage },
    x,
    y
  );
}

export function conditionNode(
  id: string,
  conditionVariable: string,
  conditionOperator: "contains" | "equals" | "not_equals",
  conditionValue: string,
  label: string,
  x: number,
  y: number
): FlowNode {
  return node(
    id,
    "condition",
    { label, conditionVariable, conditionOperator, conditionValue },
    x,
    y
  );
}

export function branchX(index: number, total: number, spread = 220): number {
  const start = CENTER_X - ((total - 1) * spread) / 2;
  return start + index * spread;
}

export function rowY(row: number): number {
  return 40 + row * ROW_HEIGHT;
}

export function formTriggerNode(
  id: string,
  label: string,
  formSamplePayload: Record<string, unknown>,
  x = CENTER_X,
  y = 40
): FlowNode {
  return node(
    id,
    "trigger",
    { label, triggerType: "web_form_submitted", formSamplePayload },
    x,
    y
  );
}

export function saveContactNode(
  id: string,
  bindings: { phone: string; name?: string; email?: string },
  label: string,
  tags: string[],
  x: number,
  y: number
): FlowNode {
  return node(
    id,
    "save_contact",
    {
      label,
      contactPhoneBinding: bindings.phone,
      contactNameBinding: bindings.name,
      contactEmailBinding: bindings.email,
      contactTags: tags,
    },
    x,
    y
  );
}

export function createLeadNode(
  id: string,
  bindings: { phone: string; name?: string; email?: string },
  label: string,
  tags: string[],
  x: number,
  y: number
): FlowNode {
  return node(
    id,
    "create_lead",
    {
      label,
      leadPhoneBinding: bindings.phone,
      leadNameBinding: bindings.name,
      leadEmailBinding: bindings.email,
      leadTags: tags,
    },
    x,
    y
  );
}

export function createOpportunityNode(
  id: string,
  bindings: {
    title: string;
    phone: string;
    amount?: string;
    name?: string;
    email?: string;
  },
  label: string,
  tags: string[],
  x: number,
  y: number
): FlowNode {
  return node(
    id,
    "create_opportunity",
    {
      label,
      opportunityTitleBinding: bindings.title,
      opportunityPhoneBinding: bindings.phone,
      opportunityAmountBinding: bindings.amount,
      opportunityNameBinding: bindings.name,
      opportunityEmailBinding: bindings.email,
      opportunityCurrency: "USD",
      opportunityStage: "new",
      opportunityTags: tags,
    },
    x,
    y
  );
}

export function setVariableNode(
  id: string,
  variableName: string,
  variableValue: string,
  label: string,
  x: number,
  y: number
): FlowNode {
  return node(id, "set_variable", { label, variableName, variableValue }, x, y);
}

export function httpRequestNode(
  id: string,
  config: {
    url: string;
    method?: "GET" | "POST" | "PATCH";
    body?: string;
    responseVariable?: string;
  },
  label: string,
  x: number,
  y: number
): FlowNode {
  return node(
    id,
    "http_request",
    {
      label,
      httpUrl: config.url,
      httpMethod: config.method ?? "POST",
      httpBody: config.body,
      httpResponseVariable: config.responseVariable,
    },
    x,
    y
  );
}

export function sendNotificationNode(
  id: string,
  config: {
    channel: "whatsapp" | "sms" | "email";
    recipient: string;
    message?: string;
    messageText?: LocalizedText;
  },
  label: string,
  x: number,
  y: number
): FlowNode {
  return node(
    id,
    "send_notification",
    {
      label,
      notificationChannel: config.channel,
      notificationRecipientBinding: config.recipient,
      notificationMessageBinding: config.message,
      notificationMessageText: config.messageText,
    },
    x,
    y
  );
}
