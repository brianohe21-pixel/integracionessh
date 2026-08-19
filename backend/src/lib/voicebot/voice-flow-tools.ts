import { executeVoiceHttpNode } from "../flow/voice-http-executor.js";
import { loadVoiceFlowRuntime } from "../flow/voice-flow-runtime.js";
import { listFlowDefinitions } from "../dynamodb/flow.repository.js";
import { findVoiceFlowForBot } from "../flow/voice-flow-compiler.js";
import { getBot } from "../dynamodb/bot.repository.js";
import type { BotLocale } from "../../types/index.js";

export async function executeVoiceFlowTool(params: {
  tenantId: string;
  botId: string;
  locale: BotLocale;
  toolName: string;
  args: Record<string, unknown>;
  variables?: Record<string, string>;
  environment: string;
}): Promise<{ output: string; variables: Record<string, string> } | null> {
  const runtime = await loadVoiceFlowRuntime({
    tenantId: params.tenantId,
    botId: params.botId,
    locale: params.locale,
  });
  if (!runtime) return null;

  const nodeId = runtime.toolNodeByName[params.toolName];
  if (!nodeId) return null;

  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) return null;

  const flows = await listFlowDefinitions(params.tenantId, params.botId);
  const flow = findVoiceFlowForBot(flows, bot.telephonyVoiceFlowId);
  if (!flow) return null;

  const node = flow.nodes.find((item) => item.id === nodeId);
  if (!node || node.type !== "http_request") return null;

  const variables = { ...runtime.variables, ...(params.variables ?? {}) };
  return executeVoiceHttpNode({
    node,
    args: params.args,
    variables,
    tenantId: params.tenantId,
    environment: params.environment,
    flowId: flow.flowId,
  });
}
