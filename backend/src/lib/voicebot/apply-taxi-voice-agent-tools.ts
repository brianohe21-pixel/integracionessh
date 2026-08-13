import {
  createVoiceAgentHttpTool,
  listVoiceAgentHttpTools,
  makeVoiceAgentToolId,
} from "../dynamodb/voice-agent-tool.repository.js";
import { updateBot } from "../dynamodb/bot.repository.js";
import {
  buildTaxi355VoiceAgentSystemPrompt,
  buildTaxi355VoiceAgentToolTemplates,
  toVoiceAgentHttpTool,
} from "./voice-agent-tool-template.js";

export interface ApplyTaxiVoiceAgentToolsResult {
  created: string[];
  skipped: string[];
  telephonySystemPromptUpdated: boolean;
}

export async function applyTaxi355VoiceAgentTools(params: {
  tenantId: string;
  botId: string;
  updateSystemPrompt?: boolean;
}): Promise<ApplyTaxiVoiceAgentToolsResult> {
  const existing = await listVoiceAgentHttpTools(params.tenantId, params.botId);
  const existingNames = new Set(existing.map((tool) => tool.name));
  const templates = buildTaxi355VoiceAgentToolTemplates();
  const now = new Date().toISOString();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const template of templates) {
    if (existingNames.has(template.name)) {
      skipped.push(template.name);
      continue;
    }
    const tool = toVoiceAgentHttpTool(
      params.tenantId,
      params.botId,
      makeVoiceAgentToolId(),
      template,
      now
    );
    await createVoiceAgentHttpTool(tool);
    created.push(template.name);
    existingNames.add(template.name);
  }

  let telephonySystemPromptUpdated = false;
  if (params.updateSystemPrompt !== false) {
    await updateBot(params.tenantId, params.botId, {
      telephonySystemPrompt: buildTaxi355VoiceAgentSystemPrompt(),
    });
    telephonySystemPromptUpdated = true;
  }

  return { created, skipped, telephonySystemPromptUpdated };
}
