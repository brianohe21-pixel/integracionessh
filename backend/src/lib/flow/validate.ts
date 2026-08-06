import { extractBindingPaths } from "./binding.js";
import type { FlowDefinition, FlowNode, FlowNodeType } from "../../types/index.js";

export interface FlowValidationIssue {
  code: string;
  message: string;
  nodeId?: string;
}

const CONVERSATION_ONLY_NODES: FlowNodeType[] = [
  "buttons",
  "meta_flow",
  "handoff",
  "book_appointment",
  "request_payment",
  "send_catalog",
  "send_products",
  "await_order",
];

const BRANCHING_NODES: FlowNodeType[] = ["condition", "buttons"];

function isFormFlow(flow: FlowDefinition): boolean {
  const trigger = flow.nodes.find((n) => n.type === "trigger");
  return trigger?.data.triggerType === "web_form_submitted";
}

function getTriggerNode(flow: FlowDefinition): FlowNode | undefined {
  return flow.nodes.find((n) => n.type === "trigger");
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
    for (const edge of flow.edges.filter((e) => e.source === current)) {
      queue.push(edge.target);
    }
  }

  return visited;
}

function validateBindings(
  node: FlowNode,
  issues: FlowValidationIssue[]
): void {
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
    for (const path of extractBindingPaths(binding.value)) {
      if (!path.startsWith("form.")) {
        issues.push({
          code: "invalid_binding",
          message: `Binding ${path} must start with form.`,
          nodeId: node.id,
        });
      }
    }
  }
}

export function validateFlowDefinition(flow: FlowDefinition): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  const triggers = flow.nodes.filter((n) => n.type === "trigger");
  const formFlow = isFormFlow(flow);

  if (triggers.length !== 1) {
    issues.push({
      code: "trigger_count",
      message: "Flow must have exactly one trigger node",
    });
  }

  const trigger = getTriggerNode(flow);
  if (trigger && formFlow) {
    if (trigger.data.triggerType !== "web_form_submitted") {
      issues.push({
        code: "invalid_trigger",
        message: "Form flows must use web_form_submitted trigger",
        nodeId: trigger.id,
      });
    }
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

    if (formFlow && CONVERSATION_ONLY_NODES.includes(node.type)) {
      issues.push({
        code: "unsupported_node",
        message: `${node.type} is not supported in form flows`,
        nodeId: node.id,
      });
    }

    if (node.type === "save_contact" || node.type === "create_lead" || node.type === "send_notification") {
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

    if (BRANCHING_NODES.includes(node.type)) {
      const outgoing = flow.edges.filter((e) => e.source === node.id);
      if (node.type === "condition") {
        const handles = new Set(outgoing.map((e) => e.sourceHandle));
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
      if (node.type === "buttons") {
        const buttons = node.data.buttons ?? [];
        if (buttons.length === 0) {
          issues.push({
            code: "missing_buttons",
            message: "Buttons node requires at least one button",
            nodeId: node.id,
          });
        }
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
