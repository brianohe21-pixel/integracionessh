import { randomUUID } from "crypto";
import {
  createFlowRun,
  getActiveFlowRunForConversation,
  getFlowDefinition,
  getFlowRun,
  updateFlowRun,
} from "../dynamodb/flow.repository.js";
import {
  clearActiveFlowRun,
  setActiveFlowRun,
} from "../dynamodb/conversation.repository.js";
import type {
  Bot,
  Conversation,
  FlowDefinition,
  FlowRun,
  InboundNormalized,
} from "../../types/index.js";
import { executeNode } from "./nodes/index.js";
import { scheduleFlowResume } from "./schedule.js";
import type { FlowExecutionContext } from "./types.js";

const MAX_STEPS_PER_RUN = 50;

export interface FlowPipelineResult {
  handled: boolean;
  halt: boolean;
}

function buildContext(params: {
  tenantId: string;
  botId: string;
  bot: Bot;
  conversation: Conversation;
  phoneNumberId: string;
  accessToken: string;
  customerPhone: string;
  replyToMessageId?: string;
  inbound: InboundNormalized;
  flow: FlowDefinition;
  buttonReplyId?: string;
}): FlowExecutionContext {
  return { ...params };
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
      });
      await clearActiveFlowRun(ctx.tenantId, ctx.botId, ctx.conversation.conversationId);
      return { handled: true, halt: true };
    }

    const result = await executeNode(node, ctx, { ...run, variables, currentNodeId });

    if (result.variables) {
      variables = { ...variables, ...result.variables };
    }

    stepCount += 1;
    const step: FlowRun["stepHistory"][number] = {
      nodeId: node.id,
      at: new Date().toISOString(),
      ...(result.output ? { output: result.output } : {}),
    };
    const history = [...run.stepHistory, step];

    if (result.wait) {
      const status = result.waitingUntil ? "waiting" : "active";
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
      return { handled: true, halt: true };
    }

    if (result.halt || !result.nextNodeId) {
      const completed = node.type === "end" || !result.nextNodeId;
      await updateFlowRun(ctx.tenantId, run.runId, {
        status: completed ? "completed" : "active",
        currentNodeId: result.nextNodeId ?? node.id,
        variables,
        stepHistory: history,
        stepCount,
      });
      if (completed) {
        await clearActiveFlowRun(ctx.tenantId, ctx.botId, ctx.conversation.conversationId);
      }
      return { handled: true, halt: result.halt };
    }

    currentNodeId = result.nextNodeId;
    run = { ...run, stepHistory: history, variables, stepCount };
    const { buttonReplyId: _drop, ...ctxBase } = ctx;
    ctx = ctxBase;
  }

  await updateFlowRun(ctx.tenantId, run.runId, {
    status: "failed",
    stepCount,
    variables,
  });
  await clearActiveFlowRun(ctx.tenantId, ctx.botId, ctx.conversation.conversationId);
  return { handled: true, halt: true };
}

export async function startFlowRun(params: {
  flow: FlowDefinition;
  tenantId: string;
  botId: string;
  bot: Bot;
  conversation: Conversation;
  phoneNumberId: string;
  accessToken: string;
  customerPhone: string;
  replyToMessageId?: string;
  inbound: InboundNormalized;
}): Promise<FlowPipelineResult> {
  const now = new Date().toISOString();
  const entryId =
    params.flow.entryNodeId ||
    params.flow.nodes.find((n) => n.type === "trigger")?.id ||
    params.flow.nodes[0]?.id;

  if (!entryId) {
    return { handled: false, halt: false };
  }

  const run: FlowRun = {
    runId: randomUUID(),
    flowId: params.flow.flowId,
    tenantId: params.tenantId,
    botId: params.botId,
    conversationId: params.conversation.conversationId,
    customerPhone: params.customerPhone,
    status: "active",
    currentNodeId: entryId,
    variables: { last_input: params.inbound.text },
    stepHistory: [],
    stepCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await createFlowRun(run);
  await setActiveFlowRun(
    params.tenantId,
    params.botId,
    params.conversation.conversationId,
    run.runId
  );

  const ctx = buildContext({ ...params, flow: params.flow });
  return runFromNode(run, params.flow, ctx);
}

export async function advanceFlowRun(params: {
  tenantId: string;
  botId: string;
  bot: Bot;
  conversation: Conversation;
  phoneNumberId: string;
  accessToken: string;
  customerPhone: string;
  replyToMessageId?: string;
  inbound: InboundNormalized;
  runId?: string;
}): Promise<FlowPipelineResult> {
  const run =
    (params.runId
      ? await getFlowRun(params.tenantId, params.runId)
      : null) ??
    (params.conversation.activeFlowRunId
      ? await getFlowRun(params.tenantId, params.conversation.activeFlowRunId)
      : null) ??
    (await getActiveFlowRunForConversation(params.tenantId, params.conversation.conversationId));

  if (!run || (run.status !== "active" && run.status !== "waiting")) {
    return { handled: false, halt: false };
  }

  const flow = await getFlowDefinition(params.tenantId, run.flowId);
  if (!flow) {
    return { handled: false, halt: false };
  }

  let buttonReplyId: string | undefined;
  if (params.inbound.interactive?.kind === "button" && params.inbound.interactive.id) {
    buttonReplyId = params.inbound.interactive.id;
  }

  if (run.status === "waiting" && run.waitingUntil) {
    if (new Date(run.waitingUntil).getTime() > Date.now() && !buttonReplyId) {
      return { handled: true, halt: true };
    }
    await updateFlowRun(params.tenantId, run.runId, {
      status: "active",
      variables: { ...run.variables, last_input: params.inbound.text },
    });
    run.status = "active";
    run.variables = { ...run.variables, last_input: params.inbound.text };
  } else {
    run.variables = { ...run.variables, last_input: params.inbound.text };
  }

  const currentNode = flow.nodes.find((n) => n.id === run.currentNodeId);
  if (currentNode?.type === "buttons" && buttonReplyId) {
    const ctx = buildContext({ ...params, flow, buttonReplyId });
    return runFromNode(run, flow, ctx);
  }

  if (currentNode?.type === "meta_flow" && params.inbound.interactive?.kind === "nfm") {
    const nextEdge = flow.edges.find((e) => e.source === currentNode.id);
    const nextNodeId = nextEdge?.target ?? null;
    if (nextNodeId) {
      const updated = await updateFlowRun(params.tenantId, run.runId, {
        currentNodeId: nextNodeId,
        status: "active",
        variables: {
          ...run.variables,
          last_input: params.inbound.text,
          flow_response: params.inbound.interactive.responseJson ?? "",
        },
      });
      if (updated) {
        const ctx = buildContext({ ...params, flow });
        return runFromNode(updated, flow, ctx);
      }
    }
    return { handled: true, halt: true };
  }

  if (currentNode?.type === "buttons" || currentNode?.type === "meta_flow") {
    return { handled: true, halt: true };
  }

  const nextId = flow.edges.find((e) => e.source === run.currentNodeId)?.target;
  if (!nextId) {
    return { handled: false, halt: false };
  }

  const resumed = await updateFlowRun(params.tenantId, run.runId, {
    currentNodeId: nextId,
    status: "active",
    variables: run.variables,
  });
  if (!resumed) return { handled: false, halt: false };

  const ctx = buildContext({ ...params, flow });
  return runFromNode(resumed, flow, ctx);
}

export async function resumeFlowRunById(
  tenantId: string,
  runId: string
): Promise<void> {
  const run = await getFlowRun(tenantId, runId);
  if (!run || run.status !== "waiting") return;

  const flow = await getFlowDefinition(tenantId, run.flowId);
  if (!flow) return;

  const resumed = await updateFlowRun(tenantId, runId, {
    status: "active",
  });
  if (!resumed) return;

  const { getBot } = await import("../dynamodb/bot.repository.js");
  const { getConversation } = await import("../dynamodb/conversation.repository.js");
  const { getWhatsAppAccessToken } = await import("../whatsapp/client.js");

  const bot = await getBot(tenantId, run.botId);
  if (!bot) return;
  const conversation = await getConversation(tenantId, run.botId, run.conversationId);
  if (!conversation) return;
  const accessToken = await getWhatsAppAccessToken(tenantId, process.env.ENVIRONMENT ?? "dev");

  const ctx = buildContext({
    tenantId,
    botId: run.botId,
    bot,
    conversation,
    phoneNumberId: bot.phoneNumberId,
    accessToken,
    customerPhone: run.customerPhone,
    inbound: { text: "", messageType: "text", raw: { from: run.customerPhone, id: "", timestamp: "", type: "text" } },
    flow,
  });

  await runFromNode(resumed, flow, ctx);
}
