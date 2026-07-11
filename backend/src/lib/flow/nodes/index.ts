import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { executeBookAppointmentNode } from "./book-appointment.js";
import { executeRequestPaymentNode } from "./request-payment.js";
import { executeButtonsNode } from "./buttons.js";
import { executeConditionNode } from "./condition.js";
import { executeDelayNode } from "./delay.js";
import { executeEndNode } from "./end.js";
import { executeHandoffNode } from "./handoff.js";
import { executeHttpRequestNode } from "./http.js";
import { executeMessageNode } from "./message.js";
import { executeMetaFlowNode } from "./meta-flow.js";
import { executeSetVariableNode } from "./set-variable.js";
import { executeTemplateNode } from "./template.js";
import { executeTriggerNode } from "./trigger.js";

export async function executeNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  switch (node.type) {
    case "trigger":
      return executeTriggerNode(node, ctx, run);
    case "message":
      return executeMessageNode(node, ctx, run);
    case "template":
      return executeTemplateNode(node, ctx, run);
    case "condition":
      return executeConditionNode(node, ctx, run);
    case "buttons":
      return executeButtonsNode(node, ctx, run);
    case "meta_flow":
      return executeMetaFlowNode(node, ctx, run);
    case "handoff":
      return executeHandoffNode(node, ctx, run);
    case "delay":
      return executeDelayNode(node, ctx, run);
    case "set_variable":
      return executeSetVariableNode(node, ctx, run);
    case "http_request":
      return executeHttpRequestNode(node, ctx, run);
    case "book_appointment":
      return executeBookAppointmentNode(node, ctx, run);
    case "request_payment":
      return executeRequestPaymentNode(node, ctx, run);
    case "end":
      return executeEndNode(node, ctx, run);
    default:
      return { nextNodeId: null, halt: true, wait: false };
  }
}
