import type { FlowDefinition, FlowNode } from "../../types/index.js";
import { getFlowSecretNamesSet } from "./flow-secrets.repository.js";
import { isVoiceAiFlow } from "./voice-flow-compiler.js";
import { isWebhookReceivingFlow } from "./webhook-flow.js";

export interface FlowValidationIssue {
  code: string;
  message: string;
  nodeId?: string;
}

const CONVERSATION_ONLY_NODES = [
  "buttons",
  "meta_flow",
  "handoff",
  "book_appointment",
  "request_payment",
  "send_catalog",
  "send_products",
  "await_order",
] as const;

const BRANCHING_NODES = ["condition", "buttons"] as const;

function isFormFlow(flow: FlowDefinition): boolean {
  return isWebhookReceivingFlow(flow.nodes);
}

function getTriggerNode(flow: FlowDefinition): FlowNode | undefined {
  return flow.nodes.find((node) => node.type === "trigger");
}

function reachableNodeIds(flow: FlowDefinition): Set<string> {
  const trigger = getTriggerNode(flow);
  if (!trigger) return new Set();

  const visited = new Set<string>();
  const queue = [trigger.id];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    for (const edge of flow.edges.filter((item) => item.source === current)) {
      queue.push(edge.target);
    }
  }

  return visited;
}

function extractSecretRefs(value: string): string[] {
  const refs: string[] = [];
  const pattern = /\{\{secret\.([^}]+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    refs.push(match[1].trim());
  }
  return refs;
}

function validateBindings(node: FlowNode, issues: FlowValidationIssue[]): void {
  const bindingFields: Array<{ field: string; value?: string; required?: boolean }> = [];

  if (node.type === "save_contact") {
    bindingFields.push(
      ...(node.data.contactPhoneBinding
        ? [{ field: "contactPhoneBinding", value: node.data.contactPhoneBinding, required: true as const }]
        : [{ field: "contactPhoneBinding", required: true as const }]),
      ...(node.data.contactNameBinding
        ? [{ field: "contactNameBinding", value: node.data.contactNameBinding }]
        : []),
      ...(node.data.contactEmailBinding
        ? [{ field: "contactEmailBinding", value: node.data.contactEmailBinding }]
        : [])
    );
  }

  if (node.type === "create_lead") {
    bindingFields.push(
      ...(node.data.leadPhoneBinding
        ? [{ field: "leadPhoneBinding", value: node.data.leadPhoneBinding, required: true as const }]
        : [{ field: "leadPhoneBinding", required: true as const }]),
      ...(node.data.leadNameBinding
        ? [{ field: "leadNameBinding", value: node.data.leadNameBinding }]
        : []),
      ...(node.data.leadEmailBinding
        ? [{ field: "leadEmailBinding", value: node.data.leadEmailBinding }]
        : [])
    );
  }

  if (node.type === "create_opportunity") {
    bindingFields.push(
      ...(node.data.opportunityTitleBinding
        ? [{ field: "opportunityTitleBinding", value: node.data.opportunityTitleBinding, required: true as const }]
        : [{ field: "opportunityTitleBinding", required: true as const }]),
      ...(node.data.opportunityPhoneBinding
        ? [{ field: "opportunityPhoneBinding", value: node.data.opportunityPhoneBinding, required: true as const }]
        : [{ field: "opportunityPhoneBinding", required: true as const }]),
      ...(node.data.opportunityAmountBinding
        ? [{ field: "opportunityAmountBinding", value: node.data.opportunityAmountBinding }]
        : []),
      ...(node.data.opportunityNameBinding
        ? [{ field: "opportunityNameBinding", value: node.data.opportunityNameBinding }]
        : []),
      ...(node.data.opportunityEmailBinding
        ? [{ field: "opportunityEmailBinding", value: node.data.opportunityEmailBinding }]
        : []),
      ...(node.data.opportunityDescriptionBinding
        ? [{ field: "opportunityDescriptionBinding", value: node.data.opportunityDescriptionBinding }]
        : [])
    );
  }

  if (node.type === "send_notification") {
    bindingFields.push(
      ...(node.data.notificationRecipientBinding
        ? [{
            field: "notificationRecipientBinding",
            value: node.data.notificationRecipientBinding,
            required: true as const,
          }]
        : [{ field: "notificationRecipientBinding", required: true as const }]),
      ...(node.data.notificationMessageBinding
        ? [{ field: "notificationMessageBinding", value: node.data.notificationMessageBinding }]
        : [])
    );
  }

  for (const binding of bindingFields) {
    if (binding.required && !binding.value?.trim()) {
      issues.push({
        code: "missing_binding",
        message: `${binding.field} is required`,
        nodeId: node.id,
      });
      continue;
    }
    if (!binding.value) continue;
    for (const path of binding.value.match(/\{\{([^}]+)\}\}/g) ?? []) {
      if (!path.includes("form.")) {
        issues.push({
          code: "invalid_binding",
          message: `Binding ${path} must start with form.`,
          nodeId: node.id,
        });
      }
    }
  }
}

function validateVoiceFlow(flow: FlowDefinition, issues: FlowValidationIssue[]): void {
  const trigger = getTriggerNode(flow);
  if (!trigger || trigger.data.triggerType !== "voice_call") {
    issues.push({
      code: "invalid_voice_trigger",
      message: "Voice flows must use voice_call trigger",
      ...(trigger?.id ? { nodeId: trigger.id } : {}),
    });
  }

  const toolNames = new Set<string>();
  for (const node of flow.nodes) {
    if (node.type !== "http_request") continue;
    const toolName = node.data.voiceToolName?.trim();
    if (!toolName) {
      issues.push({
        code: "missing_voice_tool_name",
        message: "HTTP nodes in voice flows require voiceToolName",
        nodeId: node.id,
      });
      continue;
    }
    if (toolNames.has(toolName)) {
      issues.push({
        code: "duplicate_voice_tool_name",
        message: `Duplicate voice tool name: ${toolName}`,
        nodeId: node.id,
      });
    }
    toolNames.add(toolName);
    if (!node.data.httpUrl?.trim()) {
      issues.push({
        code: "missing_http_url",
        message: "httpUrl is required",
        nodeId: node.id,
      });
    }
    if (node.data.httpUrl && !node.data.httpUrl.startsWith("https://")) {
      issues.push({
        code: "invalid_http_url",
        message: "httpUrl must use HTTPS",
        nodeId: node.id,
      });
    }
    if (node.data.voiceToolParameters?.trim()) {
      try {
        JSON.parse(node.data.voiceToolParameters);
      } catch {
        issues.push({
          code: "invalid_voice_tool_parameters",
          message: "voiceToolParameters must be valid JSON",
          nodeId: node.id,
        });
      }
    }
  }
}

export async function validateFlowDefinitionWithSecrets(
  flow: FlowDefinition,
  environment: string
): Promise<FlowValidationIssue[]> {
  const issues = validateFlowDefinition(flow);
  if (!isVoiceAiFlow(flow) || !flow.enabled) return issues;

  const configuredSecrets = await getFlowSecretNamesSet(flow.tenantId, environment, flow.flowId);
  for (const node of flow.nodes) {
    if (node.type !== "http_request") continue;
    const refs = new Set<string>([
      ...extractSecretRefs(node.data.httpUrl ?? ""),
      ...extractSecretRefs(node.data.httpBody ?? ""),
      ...(node.data.httpHeaders ?? []).flatMap((header) => [
        ...extractSecretRefs(header.key),
        ...extractSecretRefs(header.value),
      ]),
    ]);
    for (const ref of refs) {
      if (!configuredSecrets.has(ref)) {
        issues.push({
          code: "missing_flow_secret",
          message: `Missing flow secret: ${ref}`,
          nodeId: node.id,
        });
      }
    }
  }

  return issues;
}

export function validateFlowDefinition(flow: FlowDefinition): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  const triggers = flow.nodes.filter((node) => node.type === "trigger");
  const formFlow = isFormFlow(flow);
  const voiceFlow = isVoiceAiFlow(flow);

  if (triggers.length !== 1) {
    issues.push({
      code: "trigger_count",
      message: "Flow must have exactly one trigger node",
    });
  }

  const trigger = getTriggerNode(flow);
  if (voiceFlow) {
    validateVoiceFlow(flow, issues);
  }

  const reachable = reachableNodeIds(flow);
  for (const node of flow.nodes) {
    if (!reachable.has(node.id) && node.type !== "trigger") {
      issues.push({
        code: "orphan_node",
        message: "Node is not reachable from trigger",
        nodeId: node.id,
      });
    }

    if (formFlow && CONVERSATION_ONLY_NODES.includes(node.type as (typeof CONVERSATION_ONLY_NODES)[number])) {
      issues.push({
        code: "unsupported_node",
        message: `${node.type} is not supported in form flows`,
        nodeId: node.id,
      });
    }

    if (
      voiceFlow &&
      ["buttons", "meta_flow", "book_appointment", "request_payment", "send_catalog", "send_products", "await_order"].includes(
        node.type
      )
    ) {
      issues.push({
        code: "unsupported_voice_node",
        message: `${node.type} is not supported in voice flows`,
        nodeId: node.id,
      });
    }

    if (node.type === "assign_bot") {
      if (!node.data.botId?.trim()) {
        issues.push({
          code: "missing_bot",
          message: "Select a bot in the assign bot node",
          nodeId: node.id,
        });
      }
    }

    if (node.type === "save_contact" || node.type === "create_lead" || node.type === "create_opportunity" || node.type === "send_notification") {
      validateBindings(node, issues);
    }

    if (node.type === "send_notification") {
      if (!node.data.notificationChannel) {
        issues.push({
          code: "missing_channel",
          message: "notificationChannel is required",
          nodeId: node.id,
        });
      }
      if (!node.data.notificationMessageBinding && !node.data.notificationMessageText) {
        issues.push({
          code: "missing_message",
          message: "Notification requires message binding or localized text",
          nodeId: node.id,
        });
      }
    }

    if (BRANCHING_NODES.includes(node.type as (typeof BRANCHING_NODES)[number])) {
      const outgoing = flow.edges.filter((edge) => edge.source === node.id);
      if (node.type === "condition") {
        const handles = new Set(outgoing.map((edge) => edge.sourceHandle));
        for (const handle of ["true", "false"]) {
          if (!handles.has(handle)) {
            issues.push({
              code: "missing_branch",
              message: `Condition node missing ${handle} branch`,
              nodeId: node.id,
            });
          }
        }
      }
      if (node.type === "buttons" && (node.data.buttons ?? []).length === 0) {
        issues.push({
          code: "missing_buttons",
          message: "Buttons node requires at least one button",
          nodeId: node.id,
        });
      }
    }
  }

  if (flow.entryNodeId && trigger && flow.entryNodeId !== trigger.id) {
    issues.push({
      code: "invalid_entry",
      message: "entryNodeId must match trigger node",
      nodeId: trigger.id,
    });
  }

  return issues;
}

export function assertValidFlowDefinition(flow: FlowDefinition): void {
  const issues = validateFlowDefinition(flow);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join("; "));
  }
}
