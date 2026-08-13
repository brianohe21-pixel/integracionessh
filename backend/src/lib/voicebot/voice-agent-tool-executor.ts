import { executeVoiceHttpNode } from "../flow/voice-http-executor.js";
import { getVoiceAgentHttpToolByName } from "../dynamodb/voice-agent-tool.repository.js";
import { getVoiceAgentToolSecrets } from "./voice-agent-tool-secrets.repository.js";
import { voiceAgentToolToFlowNode } from "./voice-agent-tool-compiler.js";
import type { BotLocale } from "../../types/index.js";

export async function executeVoiceAgentHttpTool(params: {
  tenantId: string;
  botId: string;
  toolName: string;
  args: Record<string, unknown>;
  variables?: Record<string, string>;
  environment: string;
}): Promise<{ output: string; variables: Record<string, string> } | null> {
  const tool = await getVoiceAgentHttpToolByName(params.tenantId, params.botId, params.toolName);
  if (!tool || !tool.enabled) return null;

  const secrets = await getVoiceAgentToolSecrets(
    params.tenantId,
    params.environment,
    params.botId
  );
  const node = voiceAgentToolToFlowNode(tool);
  const variables = { ...(params.variables ?? {}) };

  return executeVoiceHttpNode({
    node,
    args: params.args,
    variables,
    tenantId: params.tenantId,
    environment: params.environment,
    secretsOverride: secrets,
  });
}

export async function executeVoiceAgentHttpToolById(params: {
  tenantId: string;
  botId: string;
  toolId: string;
  args: Record<string, unknown>;
  variables?: Record<string, string>;
  environment: string;
  locale?: BotLocale;
}): Promise<{ output: string; variables: Record<string, string> } | null> {
  const { getVoiceAgentHttpTool } = await import("../dynamodb/voice-agent-tool.repository.js");
  const tool = await getVoiceAgentHttpTool(params.tenantId, params.botId, params.toolId);
  if (!tool) return null;

  const secrets = await getVoiceAgentToolSecrets(
    params.tenantId,
    params.environment,
    params.botId
  );
  const node = voiceAgentToolToFlowNode(tool);
  const variables = { ...(params.variables ?? {}) };

  return executeVoiceHttpNode({
    node,
    args: params.args,
    variables,
    tenantId: params.tenantId,
    environment: params.environment,
    secretsOverride: secrets,
  });
}
