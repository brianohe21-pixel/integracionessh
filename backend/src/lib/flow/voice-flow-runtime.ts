import { getBot } from "../dynamodb/bot.repository.js";
import { listFlowDefinitions } from "../dynamodb/flow.repository.js";
import {
  compileVoiceFlow,
  findVoiceFlowForBot,
  type CompiledVoiceFlow,
} from "./voice-flow-compiler.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import { buildVoicebotTools } from "../voicebot/realtime-config.js";
import type { BotLocale } from "../../types/index.js";

export interface VoiceFlowRuntimeConfig {
  flowId: string;
  flowName: string;
  instructions: string;
  tools: Array<Record<string, unknown>>;
  variables: Record<string, string>;
  toolNodeByName: Record<string, string>;
  hasHandoff: boolean;
  knowledgeEnabled: boolean;
  calendarEnabled: boolean;
}

export async function loadVoiceFlowRuntime(params: {
  tenantId: string;
  botId: string;
  locale: BotLocale;
}): Promise<VoiceFlowRuntimeConfig | null> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) return null;

  const flows = await listFlowDefinitions(params.tenantId, params.botId);
  const flow = findVoiceFlowForBot(flows, bot.telephonyVoiceFlowId);
  if (!flow) return null;

  const compiled = compileVoiceFlow(flow, params.locale);
  if (!compiled) return null;

  const calendarConfig = await getCalendarConfig(params.tenantId, params.botId);
  const fallbackTools = buildVoicebotTools({
    locale: params.locale,
    knowledgeEnabled: Boolean(bot.knowledgeEnabled),
    calendarEnabled: Boolean(calendarConfig?.enabled),
    handoffEnabled: compiled.hasHandoff || Boolean(bot.telephonyHandoffEnabled),
  });

  const toolNames = new Set(compiled.openAiTools.map((tool) => String(tool.name ?? "")));
  const mergedTools = [
    ...compiled.openAiTools,
    ...fallbackTools.filter((tool) => !toolNames.has(String(tool.name ?? ""))),
  ];

  return {
    flowId: compiled.flowId,
    flowName: compiled.flowName,
    instructions: compiled.instructions,
    tools: mergedTools,
    variables: compiled.variables,
    toolNodeByName: compiled.toolNodeByName,
    hasHandoff: compiled.hasHandoff || Boolean(bot.telephonyHandoffEnabled),
    knowledgeEnabled: Boolean(bot.knowledgeEnabled),
    calendarEnabled: Boolean(calendarConfig?.enabled),
  };
}

export async function loadCompiledVoiceFlow(params: {
  tenantId: string;
  botId: string;
  locale: BotLocale;
}): Promise<{ flow: CompiledVoiceFlow; runtime: VoiceFlowRuntimeConfig } | null> {
  const runtime = await loadVoiceFlowRuntime(params);
  if (!runtime) return null;
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) return null;
  const flows = await listFlowDefinitions(params.tenantId, params.botId);
  const flow = findVoiceFlowForBot(flows, bot.telephonyVoiceFlowId);
  if (!flow) return null;
  const compiled = compileVoiceFlow(flow, params.locale);
  if (!compiled) return null;
  return { flow: compiled, runtime };
}
