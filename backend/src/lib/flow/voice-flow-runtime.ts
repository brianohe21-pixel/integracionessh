import { getBot } from "../dynamodb/bot.repository.js";
import { listFlowDefinitions } from "../dynamodb/flow.repository.js";
import {
  compileVoiceFlow,
  findVoiceFlowForBot,
  type CompiledVoiceFlow,
} from "./voice-flow-compiler.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import { listVoiceAgentHttpTools } from "../dynamodb/voice-agent-tool.repository.js";
import { compileVoiceAgentHttpTools } from "../voicebot/voice-agent-tool-compiler.js";
import { buildVoiceAgentRuntimeInstructions } from "../voicebot/voice-agent-instructions.js";
import { buildVoicebotTools } from "../voicebot/realtime-config.js";
import type { BotLocale } from "../../types/index.js";

export interface VoiceFlowRuntimeConfig {
  flowId?: string;
  flowName?: string;
  instructions: string;
  tools: Array<Record<string, unknown>>;
  variables: Record<string, string>;
  toolNodeByName: Record<string, string>;
  standaloneToolByName: Record<string, string>;
  hasHandoff: boolean;
  knowledgeEnabled: boolean;
  calendarEnabled: boolean;
}

function mergeOpenAiTools(
  groups: Array<Array<Record<string, unknown>>>
): Array<Record<string, unknown>> {
  const toolNames = new Set<string>();
  const merged: Array<Record<string, unknown>> = [];
  for (const group of groups) {
    for (const tool of group) {
      const name = String(tool.name ?? "");
      if (!name || toolNames.has(name)) continue;
      toolNames.add(name);
      merged.push(tool);
    }
  }
  return merged;
}

export async function loadVoiceFlowRuntime(params: {
  tenantId: string;
  botId: string;
  locale: BotLocale;
}): Promise<VoiceFlowRuntimeConfig | null> {
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) return null;

  const standaloneTools = await listVoiceAgentHttpTools(params.tenantId, params.botId);
  const standaloneCompiled = compileVoiceAgentHttpTools(standaloneTools);

  const flows = await listFlowDefinitions(params.tenantId, params.botId);
  const flow = findVoiceFlowForBot(flows, bot.telephonyVoiceFlowId);
  const flowCompiled = flow ? compileVoiceFlow(flow, params.locale) : null;

  const calendarConfig = await getCalendarConfig(params.tenantId, params.botId);
  const handoffEnabled =
    Boolean(flowCompiled?.hasHandoff) || Boolean(bot.telephonyHandoffEnabled);

  const fallbackTools = buildVoicebotTools({
    locale: params.locale,
    knowledgeEnabled: Boolean(bot.knowledgeEnabled),
    calendarEnabled: Boolean(calendarConfig?.enabled),
    handoffEnabled,
  });

  const tools = mergeOpenAiTools([
    standaloneCompiled.openAiTools,
    flowCompiled?.openAiTools ?? [],
    fallbackTools,
  ]);

  const instructions = await buildVoiceAgentRuntimeInstructions({
    bot,
    tenantId: params.tenantId,
    locale: params.locale,
    standaloneInstructionLines: standaloneCompiled.instructionLines,
    handoffEnabled,
    knowledgeEnabled: Boolean(bot.knowledgeEnabled),
    ...(flowCompiled?.instructions ? { flowInstructions: flowCompiled.instructions } : {}),
  });

  return {
    instructions,
    tools,
    variables: { ...(flowCompiled?.variables ?? {}) },
    toolNodeByName: flowCompiled?.toolNodeByName ?? {},
    standaloneToolByName: standaloneCompiled.toolByName,
    hasHandoff: handoffEnabled,
    knowledgeEnabled: Boolean(bot.knowledgeEnabled),
    calendarEnabled: Boolean(calendarConfig?.enabled),
    ...(flowCompiled?.flowId ? { flowId: flowCompiled.flowId } : {}),
    ...(flowCompiled?.flowName ? { flowName: flowCompiled.flowName } : {}),
  };
}

export async function loadCompiledVoiceFlow(params: {
  tenantId: string;
  botId: string;
  locale: BotLocale;
}): Promise<{ flow: CompiledVoiceFlow; runtime: VoiceFlowRuntimeConfig } | null> {
  const runtime = await loadVoiceFlowRuntime(params);
  if (!runtime?.flowId) return null;
  const bot = await getBot(params.tenantId, params.botId);
  if (!bot) return null;
  const flows = await listFlowDefinitions(params.tenantId, params.botId);
  const flow = findVoiceFlowForBot(flows, bot.telephonyVoiceFlowId);
  if (!flow) return null;
  const compiled = compileVoiceFlow(flow, params.locale);
  if (!compiled) return null;
  return { flow: compiled, runtime };
}
