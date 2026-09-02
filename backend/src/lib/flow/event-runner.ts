import { randomUUID } from "crypto";
import {
  createFlowRun,
  getFlowDefinition,
  getFlowRun,
  updateFlowRun,
} from "../dynamodb/flow.repository.js";
import { updateFlowEventSubmission } from "../dynamodb/flow-event.repository.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { getWhatsAppAccessToken } from "../whatsapp/client.js";
import type { FlowDefinition, FlowRun } from "../../types/index.js";
import { executeNode } from "./nodes/index.js";
import { flattenFormPayload } from "./binding.js";
import { resolveFlowBotId } from "./resolve-flow-bot.js";
import { scheduleFlowResume } from "./schedule.js";
import type { FlowExecutionContext } from "./types.js";
import type { FlowPipelineResult } from "./event-types.js";

export type { FlowPipelineResult } from "./event-types.js";

const MAX_STEPS_PER_RUN = 50;

async function buildEventContext(params: {
  tenantId: string;
  botId?: string;
  flow: FlowDefinition;
  formPayload: Record<string, unknown>;
}): Promise<FlowExecutionContext> {
  let accessToken = "";
  let phoneNumberId: string | undefined;

  if (params.botId) {
    const bot = await getBot(params.tenantId, params.botId);
    if (!bot) throw new Error("Bot not found");
    phoneNumberId = bot.phoneNumberId;
    try {
      accessToken = await getWhatsAppAccessToken(
        params.tenantId,
        process.env.ENVIRONMENT ?? "dev"
      );
    } catch {
      accessToken = "";
    }

    return {
      mode: "event",
      tenantId: params.tenantId,
      botId: params.botId,
      bot,
      flow: params.flow,
      environment: process.env.ENVIRONMENT ?? "dev",
      formPayload: params.formPayload,
      phoneNumberId,
      accessToken,
      channel: "whatsapp",
    };
  }

  return {
    mode: "event",
    tenantId: params.tenantId,
    flow: params.flow,
    environment: process.env.ENVIRONMENT ?? "dev",
    formPayload: params.formPayload,
    channel: "whatsapp",
  };
}

async function runFromNode(
  run: FlowRun,
  flow: FlowDefinition,
  ctx: FlowExecutionContext
): Promise<FlowPipelineResult> {
  let currentNodeId: string | null = run.currentNodeId;
  let stepCount = run.stepCount;
  let variables = { ...run.variables };

  while (currentNodeId && stepCount < MAX_STEPS_PER_RUN) {
    const node = flow.nodes.find((n) => n.id === currentNodeId);
    if (!node) {
      await updateFlowRun(ctx.tenantId, run.runId, {
        status: "failed",
        stepCount,
        variables,
        errorMessage: `Node ${currentNodeId} not found`,
      });
      return { handled: true, halt: true, status: "failed" };
    }

    let result;
    try {
      result = await executeNode(node, ctx, { ...run, variables, currentNodeId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Node execution failed";
      const step = {
        nodeId: node.id,
        at: new Date().toISOString(),
        error: message,
      };
      await updateFlowRun(ctx.tenantId, run.runId, {
        status: "failed",
        stepCount: stepCount + 1,
        variables,
        stepHistory: [...run.stepHistory, step],
        errorMessage: message,
      });
      return { handled: true, halt: true, status: "failed", errorMessage: message };
    }

    if (result.variables) {
      variables = { ...variables, ...result.variables };
    }

    stepCount += 1;
    const step: FlowRun["stepHistory"][number] = {
      nodeId: node.id,
      at: new Date().toISOString(),
      ...(result.output ? { output: result.output } : {}),
      ...(result.error ? { error: result.error } : {}),
    };
    const history = [...run.stepHistory, step];

    if (result.wait) {
      const status = result.waitingUntil || result.externalWait ? "waiting" : "active";
      await updateFlowRun(ctx.tenantId, run.runId, {
        currentNodeId: result.nextNodeId ?? node.id,
        status,
        variables,
        stepHistory: history,
        stepCount,
        ...(result.waitingUntil ? { waitingUntil: result.waitingUntil } : {}),
      });
      if (result.waitingUntil) {
        await scheduleFlowResume(run.runId, ctx.tenantId, result.waitingUntil);
      }
      return { handled: true, halt: true, status };
    }

    if (result.halt || !result.nextNodeId) {
      const completed = node.type === "end" || !result.nextNodeId;
      const status = completed ? "completed" : "active";
      await updateFlowRun(ctx.tenantId, run.runId, {
        status,
        currentNodeId: result.nextNodeId ?? node.id,
        variables,
        stepHistory: history,
        stepCount,
      });
      return { handled: true, halt: result.halt, status };
    }

    currentNodeId = result.nextNodeId;
    run = { ...run, stepHistory: history, variables, stepCount };
  }

  await updateFlowRun(ctx.tenantId, run.runId, {
    status: "failed",
    stepCount,
    variables,
    errorMessage: "Maximum step count exceeded",
  });
  return {
    handled: true,
    halt: true,
    status: "failed",
    errorMessage: "Maximum step count exceeded",
  };
}

export async function startEventFlowRun(params: {
  tenantId: string;
  flowId: string;
  submissionId: string;
  payload: Record<string, unknown>;
}): Promise<FlowPipelineResult> {
  const flow = await getFlowDefinition(params.tenantId, params.flowId);
  if (!flow || !flow.enabled) {
    throw new Error("Flow not found or disabled");
  }
  const resolvedBotId = resolveFlowBotId(flow);

  const entryId =
    flow.entryNodeId || flow.nodes.find((n) => n.type === "trigger")?.id || flow.nodes[0]?.id;
  if (!entryId) {
    throw new Error("Flow has no entry node");
  }

  const now = new Date().toISOString();
  const variables = flattenFormPayload(params.payload);
  const run: FlowRun = {
    runId: randomUUID(),
    flowId: flow.flowId,
    tenantId: params.tenantId,
    ...(resolvedBotId ? { botId: resolvedBotId } : {}),
    source: "event",
    eventSubmissionId: params.submissionId,
    flowVersion: flow.version,
    formPayload: params.payload,
    status: "active",
    currentNodeId: entryId,
    variables,
    stepHistory: [],
    stepCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await createFlowRun(run);
  await updateFlowEventSubmission(params.tenantId, params.submissionId, {
    status: "processing",
    runId: run.runId,
  });

  const ctx = await buildEventContext({
    tenantId: params.tenantId,
    ...(resolvedBotId ? { botId: resolvedBotId } : {}),
    flow,
    formPayload: params.payload,
  });

  const result = await runFromNode(run, flow, ctx);

  if (params.submissionId) {
    await updateFlowEventSubmission(params.tenantId, params.submissionId, {
      status: result.status === "failed" ? "failed" : result.status === "completed" ? "completed" : "processing",
      runId: run.runId,
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    });
  }

  return result;
}

export async function resumeEventFlowRun(
  tenantId: string,
  runId: string
): Promise<FlowPipelineResult | null> {
  const run = await getFlowRun(tenantId, runId);
  if (!run || run.source !== "event" || run.status !== "waiting") return null;

  const flow = await getFlowDefinition(tenantId, run.flowId);
  if (!flow) return null;

  const resumed = await updateFlowRun(tenantId, runId, {
    status: "active",
  });
  if (!resumed) return null;

  const ctx = await buildEventContext({
    tenantId,
    ...(run.botId ? { botId: run.botId } : {}),
    flow,
    formPayload: run.formPayload ?? {},
  });

  return runFromNode(resumed, flow, ctx);
}
