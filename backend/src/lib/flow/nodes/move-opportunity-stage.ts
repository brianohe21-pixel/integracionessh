import type { FlowNode, FlowRun, OpportunityStage } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import {
  buildBindingContext,
  conversationBindingFromContext,
  resolveBindingValue,
} from "../binding.js";
import { getNextNodeId } from "../graph.js";
import { getOpportunityById } from "../../dynamodb/opportunity.repository.js";
import { getPipelineById } from "../../dynamodb/pipeline.repository.js";
import { findStageByKey } from "../../sales/default-pipeline.js";
import { moveOpportunityStage } from "../../sales/opportunities/stage.js";

const STAGES: OpportunityStage[] = ["new", "quoted", "negotiation", "won", "lost"];

function parseStage(value?: string): OpportunityStage | null {
  const trimmed = value?.trim() as OpportunityStage | undefined;
  if (trimmed && STAGES.includes(trimmed)) return trimmed;
  return null;
}

function skipped(
  flow: FlowExecutionContext["flow"],
  nodeId: string,
  error: string,
  output: string
): NodeExecutionResult {
  return {
    nextNodeId: getNextNodeId(flow, nodeId, "false"),
    halt: false,
    wait: false,
    error,
    output,
  };
}

export async function executeMoveOpportunityStageNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
    conversation: conversationBindingFromContext(ctx),
  });

  const opportunityId = resolveBindingValue(
    node.data.opportunityIdBinding ?? "{{opportunity_id}}",
    bindingContext
  ).trim();
  if (!opportunityId) {
    return skipped(ctx.flow, node.id, "Opportunity id binding is required", "skipped: missing opportunity_id");
  }

  const stageKey =
    parseStage(node.data.opportunityStage) ??
    parseStage(resolveBindingValue(node.data.opportunityStageBinding, bindingContext));
  if (!stageKey) {
    throw new Error("opportunityStage is required (new, quoted, negotiation, won, lost)");
  }

  const existing = await getOpportunityById(ctx.tenantId, opportunityId);
  if (!existing) {
    return skipped(ctx.flow, node.id, "Opportunity not found", "skipped: opportunity not found");
  }

  const pipeline = await getPipelineById(ctx.tenantId, existing.pipelineId);
  if (!pipeline) {
    throw new Error("Opportunity pipeline not found");
  }

  const targetStage = findStageByKey(pipeline, stageKey);
  if (!targetStage) {
    throw new Error(`Stage ${stageKey} is not configured in the pipeline`);
  }

  const closeReason =
    resolveBindingValue(node.data.opportunityCloseReasonBinding, bindingContext).trim() ||
    undefined;

  const updated = await moveOpportunityStage({
    tenantId: ctx.tenantId,
    opportunityId,
    stageId: targetStage.stageId,
    ...(closeReason ? { closeReason } : {}),
    ...(stageKey === "lost" && node.data.opportunityLossReason
      ? { lossReason: node.data.opportunityLossReason }
      : {}),
  });

  if (!updated) {
    throw new Error("Failed to move opportunity stage");
  }

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id, "true"),
    halt: false,
    wait: false,
    variables: {
      opportunity_id: updated.opportunityId,
      opportunity_stage: updated.stage,
      opportunity_title: updated.title,
    },
    output: `${existing.stage}→${updated.stage}`,
  };
}
