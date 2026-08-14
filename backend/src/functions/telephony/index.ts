import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertTenantAccess, assertMemberRole } from "../../lib/auth/cognito.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { listCallsByBot, getCallRecord } from "../../lib/dynamodb/call.repository.js";
import { appendCallEvent, listCallEvents } from "../../lib/dynamodb/call-event.repository.js";
import { listVoiceAgentWebhookDeliveries } from "../../lib/dynamodb/voice-agent-webhook.repository.js";
import { hasTelnyxCredentials } from "../../lib/telnyx/secrets.js";
import { listOwnedPhoneNumbers } from "../../lib/telnyx/client.js";
import {
  getElevenLabsAccountTier,
  listElevenLabsVoices,
} from "../../lib/telnyx/elevenlabs.js";
import { parseTelnyxWebhookBody, verifyTelnyxWebhookSignature } from "../../lib/telnyx/webhook.js";
import { markTelnyxEventProcessed } from "../../lib/telnyx/idempotency.js";
import { getTelnyxSecrets } from "../../lib/telnyx/secrets.js";
import { resolveProviderCredential } from "../../lib/integrations/provider-credentials.js";
import { normalizeE164 } from "../../lib/telnyx/phone.js";
import { getBotByTelephonyNumber } from "../../lib/dynamodb/bot-lookup.repository.js";
import {
  handleCallAnswered,
  handleCallHangup,
  handleCallRecordingSaved,
  handleInboundCallInitiated,
  handleMachineDetectionEnded,
  handleOutboundCallRinging,
  reportCallUsage,
  startOutboundTelephonyCall,
  terminateTelephonyCall,
} from "../../lib/telephony/service.js";
import { deliverVoiceAgentWebhook } from "../../lib/telephony/webhook-delivery.js";
import { resolveTelephonyStructuredOutput } from "../../lib/telephony/structured-output-config.js";
import {
  buildStructuredOutputBotUpdates,
  parseStructuredOutputDefinitionInput,
  StructuredOutputDefinitionSchema,
} from "../../lib/telephony/structured-output-schema.js";
import { executeVoicebotTool } from "../../lib/voicebot/tools.js";
import { loadVoiceFlowRuntime } from "../../lib/flow/voice-flow-runtime.js";
import { getOpenAIApiKey } from "../../lib/ai/providers/openai.js";
import { getPresignedReadUrl } from "../../lib/s3/client.js";
import { assertSafeUrl } from "../../lib/webhook/client.js";
import { buildCallTerminatedPayload } from "../../lib/integrations/payloads.js";
import { TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH } from "../../lib/telephony/limits.js";
import type { BotLocale, IntegrationEvent } from "../../types/index.js";
import {
  accepted,
  badRequest,
  created,
  handleError,
  noContent,
  notFound,
  ok,
  parseJsonBody,
  unauthorized,
} from "../../lib/http.js";
import {
  createVoiceAgentHttpTool,
  deleteVoiceAgentHttpTool,
  getVoiceAgentHttpTool,
  listVoiceAgentHttpTools,
  makeVoiceAgentToolId,
  updateVoiceAgentHttpTool,
} from "../../lib/dynamodb/voice-agent-tool.repository.js";
import {
  deleteVoiceAgentToolSecret,
  getVoiceAgentToolSecret,
  listVoiceAgentToolSecretNames,
  saveVoiceAgentToolSecret,
} from "../../lib/voicebot/voice-agent-tool-secrets.repository.js";
import {
  buildVoiceAgentToolTestResult,
  validateVoiceAgentHttpToolInput,
  VoiceAgentHttpToolInputSchema,
} from "../../lib/voicebot/voice-agent-tool.service.js";
import type { VoiceAgentHttpTool } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

function readTelephonyResourceId(
  pathParameters: APIGatewayProxyEventV2["pathParameters"],
  rawPath: string,
  resource: "calls" | "tools"
): string | undefined {
  const paramKey = resource === "calls" ? "callId" : "toolId";
  const fromParam = pathParameters?.[paramKey];
  if (fromParam) return fromParam;
  const match = rawPath.match(
    resource === "calls" ? /\/telephony\/calls\/([^/]+)/ : /\/telephony\/tools\/([^/]+)/
  );
  const segment = match?.[1];
  if (!segment || segment === "secrets") return undefined;
  return segment;
}

function readTelephonyToolSecretName(
  pathParameters: APIGatewayProxyEventV2["pathParameters"],
  rawPath: string
): string | undefined {
  const fromParam = pathParameters?.secretName;
  if (fromParam) return fromParam;
  const match = rawPath.match(/\/telephony\/tools\/secrets\/([^/]+)$/);
  return match?.[1];
}

const VOICE_AGENT_WEBHOOK_EVENTS: IntegrationEvent[] = [
  "call.connect",
  "call.status",
  "call.terminated",
  "call.recording.ready",
  "call.cost.finalized",
];

const OutboundCallSchema = z.object({
  to: z.string().min(7).max(20),
  contactName: z.string().max(120).optional(),
});

const VoiceAgentToolSecretSchema = z.object({
  name: z.string().min(1).max(120),
  value: z.string().min(1).max(4096),
});

const VoiceAgentToolTestSchema = z.object({
  args: z.record(z.unknown()).optional(),
  variables: z.record(z.string()).optional(),
});

function serializeVoiceAgentHttpTool(tool: VoiceAgentHttpTool) {
  return {
    toolId: tool.toolId,
    name: tool.name,
    description: tool.description,
    httpUrl: tool.httpUrl,
    httpMethod: tool.httpMethod,
    httpBody: tool.httpBody ?? "",
    httpHeaders: tool.httpHeaders ?? [],
    httpResponseVariable: tool.httpResponseVariable ?? "",
    parametersJson: tool.parametersJson,
    instruction: tool.instruction ?? "",
    enabled: tool.enabled,
    sortOrder: tool.sortOrder,
    createdAt: tool.createdAt,
    updatedAt: tool.updatedAt,
  };
}

interface TelephonyGatewayInvokeEvent {
  source: "telephony-gateway";
  action: "execute_tool" | "report_usage" | "get_voice_runtime" | "report_tool_execution";
  tenantId: string;
  botId: string;
  conversationId?: string;
  participantId?: string;
  locale?: BotLocale;
  name?: string;
  arguments?: string;
  callId?: string;
  usage?: {
    openaiInputTokens?: number;
    openaiOutputTokens?: number;
    elevenlabsCharacters?: number;
  };
  toolName?: string;
  latencyMs?: number;
  success?: boolean;
  statusCode?: number;
  error?: string;
}

function isGatewayInvokeEvent(event: unknown): event is TelephonyGatewayInvokeEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as TelephonyGatewayInvokeEvent).source === "telephony-gateway"
  );
}

async function handleGatewayInvoke(
  event: TelephonyGatewayInvokeEvent
): Promise<{
  output?: string;
  handoff?: boolean;
  ok?: boolean;
  runtime?: Awaited<ReturnType<typeof loadVoiceFlowRuntime>>;
}> {
  if (event.action === "report_usage" && event.callId) {
    await reportCallUsage({
      tenantId: event.tenantId,
      callId: event.callId,
      usage: event.usage ?? {},
    });
    return { ok: true };
  }

  if (
    event.action === "report_tool_execution" &&
    event.callId &&
    event.toolName &&
    typeof event.latencyMs === "number"
  ) {
    await appendCallEvent({
      tenantId: event.tenantId,
      botId: event.botId,
      callId: event.callId,
      type: "tool_executed",
      message: event.toolName,
      metadata: {
        toolName: event.toolName,
        latencyMs: event.latencyMs,
        success: Boolean(event.success),
        ...(event.statusCode !== undefined ? { statusCode: event.statusCode } : {}),
        ...(event.error ? { error: event.error } : {}),
      },
    });
    return { ok: true };
  }

  if (event.action === "get_voice_runtime") {
    const bot = await getBot(event.tenantId, event.botId);
    if (!bot) {
      return { runtime: null };
    }
    const runtime = await loadVoiceFlowRuntime({
      tenantId: event.tenantId,
      botId: event.botId,
      locale: event.locale ?? bot.defaultLocale ?? "es",
    });
    return { runtime };
  }

  if (event.action !== "execute_tool" || !event.name || !event.arguments) {
    return { output: JSON.stringify({ error: "Invalid gateway action" }) };
  }

  const bot = await getBot(event.tenantId, event.botId);
  if (!bot) {
    return { output: JSON.stringify({ error: "Bot not found" }) };
  }

  const apiKey = await getOpenAIApiKey(event.tenantId, ENVIRONMENT);
  const voiceRuntime = await loadVoiceFlowRuntime({
    tenantId: event.tenantId,
    botId: event.botId,
    locale: event.locale ?? bot.defaultLocale ?? "es",
  });
  return executeVoicebotTool(event.name, event.arguments, {
    tenantId: event.tenantId,
    botId: event.botId,
    conversationId: event.conversationId ?? "",
    participantId: event.participantId ?? "",
    locale: event.locale ?? "es",
    knowledgeEnabled: voiceRuntime?.knowledgeEnabled ?? Boolean(bot.knowledgeEnabled),
    handoffEnabled: voiceRuntime?.hasHandoff ?? Boolean(bot.telephonyHandoffEnabled),
    apiKey,
    environment: ENVIRONMENT,
  });
}

function getRawBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) return "";
  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
}

function maskWebhookSecret(bot: Awaited<ReturnType<typeof getBot>>) {
  if (!bot) return bot;
  return {
    ...bot,
    telephonyWebhookSecret: bot.telephonyWebhookSecret ? "***" : undefined,
  };
}

async function handleTelnyxWebhook(
  event: APIGatewayProxyEventV2,
  credentialTenantId?: string
): Promise<APIGatewayProxyResultV2> {
  const rawBody = getRawBody(event);
  const secrets = await getTelnyxSecrets(ENVIRONMENT, credentialTenantId);
  const signature = event.headers["telnyx-signature-ed25519"] ?? event.headers["Telnyx-Signature-Ed25519"];
  const timestamp = event.headers["telnyx-timestamp"] ?? event.headers["Telnyx-Timestamp"];

  if (
    secrets.publicKey &&
    !verifyTelnyxWebhookSignature({
      rawBody,
      signature,
      timestamp,
      publicKey: secrets.publicKey,
    })
  ) {
    return unauthorized("Invalid Telnyx signature");
  }

  const events = parseTelnyxWebhookBody(rawBody);
  for (const envelope of events) {
    const eventId = envelope.data?.id;
    if (!eventId) continue;
    const isNew = await markTelnyxEventProcessed(eventId);
    if (!isNew) continue;

    const eventType = envelope.data.event_type;
    const payload = envelope.data.payload ?? {};
    console.log(
      "Telnyx webhook:",
      eventType,
      String(payload.call_control_id ?? ""),
      String(payload.direction ?? "")
    );

    if (eventType === "call.initiated") {
      const direction = String(payload.direction ?? "");
      if (direction === "incoming") {
        const to = normalizeE164(String(payload.to ?? ""));
        if (to) {
          const lookup = await getBotByTelephonyNumber(to);
          if (lookup) {
            const resolved = await resolveProviderCredential(
              lookup.tenantId,
              ENVIRONMENT,
              "telnyx"
            );
            const expectedOwner = credentialTenantId ?? "platform";
            if (!resolved || resolved.ownerTenantId !== expectedOwner) {
              console.warn("Telnyx webhook tenant mismatch", {
                lookupTenantId: lookup.tenantId,
                expectedOwner,
                resolvedOwner: resolved?.ownerTenantId,
              });
              continue;
            }
          }
        }
        await handleInboundCallInitiated(payload, credentialTenantId);
      } else if (direction === "outgoing") {
        await handleOutboundCallRinging(payload);
      }
      continue;
    }

    if (eventType === "call.answered") {
      await handleCallAnswered(payload);
      continue;
    }

    if (
      eventType === "call.machine.premium.detection.ended" ||
      eventType === "call.machine.detection.ended" ||
      eventType === "call.machine.premium.greeting.ended" ||
      eventType === "call.machine.greeting.ended"
    ) {
      await handleMachineDetectionEnded(payload);
      continue;
    }

    if (eventType === "call.recording.saved") {
      await handleCallRecordingSaved(payload);
      continue;
    }

    if (eventType === "call.hangup" || eventType === "call.ended") {
      await handleCallHangup(payload);
    }
  }

  return accepted({ received: true });
}

export async function handler(
  event: APIGatewayProxyEventV2 | APIGatewayProxyEventV2WithJWTAuthorizer | TelephonyGatewayInvokeEvent
): Promise<
  APIGatewayProxyResultV2 | {
    output?: string;
    handoff?: boolean;
    ok?: boolean;
    runtime?: Awaited<ReturnType<typeof loadVoiceFlowRuntime>>;
  }
> {
  try {
    if (isGatewayInvokeEvent(event)) {
      return handleGatewayInvoke(event);
    }

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const botId = event.pathParameters?.botId;
    const callId = readTelephonyResourceId(event.pathParameters, rawPath, "calls");
    const toolId = readTelephonyResourceId(event.pathParameters, rawPath, "tools");
    const secretName = readTelephonyToolSecretName(event.pathParameters, rawPath);

    const credentialTenantId = event.pathParameters?.credentialTenantId;

    if (method === "POST" && rawPath === "/telephony/webhook") {
      return handleTelnyxWebhook(event);
    }

    if (method === "POST" && credentialTenantId && rawPath.startsWith("/telephony/webhook/")) {
      const ownerId = credentialTenantId === "platform" ? undefined : credentialTenantId;
      return handleTelnyxWebhook(event, ownerId);
    }

    const auth = await resolveRequestAuth(event as APIGatewayProxyEventV2WithJWTAuthorizer);
    assertMemberRole(auth);

    if (method === "GET" && rawPath === "/telephony/numbers") {
      const configured = await hasTelnyxCredentials(ENVIRONMENT, auth.tenantId);
      if (!configured) return ok({ numbers: [] });
      const numbers = await listOwnedPhoneNumbers(ENVIRONMENT, auth.tenantId);
      return ok({ numbers });
    }

    if (method === "GET" && rawPath === "/telephony/voices") {
      try {
        const [voices, tier] = await Promise.all([
          listElevenLabsVoices(ENVIRONMENT, auth.tenantId),
          getElevenLabsAccountTier(ENVIRONMENT, auth.tenantId),
        ]);
        return ok({ voices, tier });
      } catch {
        return ok({
          voices: [{ id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", requiresPaidPlan: false }],
          tier: null,
        });
      }
    }

    if (!botId) return badRequest("Route not found");

    const bot = await getBot(auth.tenantId, botId);
    if (!bot) return notFound("Bot not found");
    assertTenantAccess(auth, bot.tenantId);

    if (method === "GET" && rawPath.endsWith("/telephony/settings")) {
      return ok({
        telephonyEnabled: Boolean(bot.telephonyEnabled),
        telephonyPhoneNumber: bot.telephonyPhoneNumber ?? "",
        telephonyVoiceId: bot.telephonyVoiceId ?? "",
        telephonyBackgroundSound: bot.telephonyBackgroundSound ?? "none",
        telephonyBackgroundSoundVolume: bot.telephonyBackgroundSoundVolume ?? 0.6,
        telephonyTtsModel: bot.telephonyTtsModel ?? "eleven_flash_v2_5",
        telephonyVoiceSpeed: bot.telephonyVoiceSpeed ?? 1,
        telephonyVoiceStability: bot.telephonyVoiceStability ?? 0.5,
        telephonyVoiceSimilarity: bot.telephonyVoiceSimilarity ?? 0.75,
        telephonyTranscriptionVadThreshold: bot.telephonyTranscriptionVadThreshold ?? 0.65,
        telephonyTranscriptionSilenceMs: bot.telephonyTranscriptionSilenceMs ?? 550,
        telephonyTranscriptionBargeIn: Boolean(bot.telephonyTranscriptionBargeIn),
        telephonyModel: bot.telephonyModel ?? bot.voicebotModel ?? "gpt-realtime-2.1-mini",
        telephonyTranscriptionModel:
          bot.telephonyTranscriptionModel ?? "gpt-4o-mini-transcribe",
        telephonyGreeting: bot.telephonyGreeting ?? "",
        telephonySystemPrompt:
          bot.telephonySystemPrompt ?? bot.voicebotSystemPrompt ?? bot.systemPrompt ?? "",
        telephonyRecordingEnabled: Boolean(bot.telephonyRecordingEnabled),
        telephonyRecordingNotice: bot.telephonyRecordingNotice ?? "",
        telephonyHandoffEnabled: Boolean(bot.telephonyHandoffEnabled),
        telephonyVoiceFlowId: bot.telephonyVoiceFlowId ?? "",
        knowledgeEnabled: Boolean(bot.knowledgeEnabled),
        telephonyWebhookUrl: bot.telephonyWebhookUrl ?? "",
        telephonyWebhookEnabled: Boolean(bot.telephonyWebhookEnabled),
        telephonyWebhookEvents: bot.telephonyWebhookEvents ?? VOICE_AGENT_WEBHOOK_EVENTS,
        telephonyWebhookSecret: bot.telephonyWebhookSecret ? "***" : undefined,
        telephonyStructuredOutput: resolveTelephonyStructuredOutput(bot),
      });
    }

    if (method === "PUT" && rawPath.endsWith("/telephony/settings")) {
      const body = parseJsonBody(event);
      const optionalNonEmptyString = (max: number) =>
        z.preprocess(
          (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
          z.string().min(1).max(max).optional()
        );

      const parsed = z
        .object({
          enabled: z.boolean().optional(),
          telephonyPhoneNumber: z.string().min(7).max(20).optional(),
          telephonyVoiceId: optionalNonEmptyString(64),
          telephonyModel: z.string().min(3).max(64).optional(),
          telephonyTranscriptionModel: z.string().min(3).max(64).optional(),
          telephonyBackgroundSound: z.string().min(1).max(32).optional(),
          telephonyBackgroundSoundVolume: z.number().min(0.01).max(1).optional(),
          telephonyTtsModel: z.string().min(3).max(64).optional(),
          telephonyVoiceSpeed: z.number().min(0.7).max(1.2).optional(),
          telephonyVoiceStability: z.number().min(0).max(1).optional(),
          telephonyVoiceSimilarity: z.number().min(0).max(1).optional(),
          telephonyTranscriptionVadThreshold: z.number().min(0.3).max(0.9).optional(),
          telephonyTranscriptionSilenceMs: z.number().min(300).max(1200).optional(),
          telephonyTranscriptionBargeIn: z.boolean().optional(),
          telephonyGreeting: z.string().max(500).optional(),
          telephonySystemPrompt: z.string().max(TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH).optional(),
          telephonyRecordingEnabled: z.boolean().optional(),
          telephonyRecordingNotice: z.string().max(500).optional(),
          telephonyHandoffEnabled: z.boolean().optional(),
          telephonyVoiceFlowId: z.union([z.string().uuid(), z.literal("")]).optional(),
          knowledgeEnabled: z.boolean().optional(),
          telephonyWebhookUrl: z.string().max(2048).optional(),
          telephonyWebhookSecret: z.string().max(256).optional(),
          telephonyWebhookEnabled: z.boolean().optional(),
          telephonyWebhookEvents: z.array(z.string()).optional(),
          telephonyStructuredOutput: StructuredOutputDefinitionSchema.nullable().optional(),
          telephonyStructuredOutputs: z
            .array(
              z.object({
                name: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).max(64),
                type: z.enum(["string", "number", "integer", "boolean"]),
                description: z.string().max(500),
                required: z.boolean().optional(),
              })
            )
            .max(20)
            .optional(),
          telephonyStructuredOutputSchemaName: z.string().max(64).optional(),
        })
        .safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      if (parsed.data.telephonyBackgroundSound !== undefined) {
        const { isValidBackgroundSoundId } = await import(
          "../../lib/telephony/background-sounds.js"
        );
        if (!isValidBackgroundSoundId(parsed.data.telephonyBackgroundSound)) {
          return badRequest("Invalid background sound preset");
        }
      }

      if (parsed.data.telephonyTtsModel !== undefined) {
        const { isValidTtsModelId } = await import("../../lib/telephony/tts-models.js");
        if (!isValidTtsModelId(parsed.data.telephonyTtsModel)) {
          return badRequest("Invalid TTS model");
        }
      }

      const { ensureTenant } = await import("../../lib/dynamodb/tenant.repository.js");
      const { updateBot } = await import("../../lib/dynamodb/bot.repository.js");
      const {
        putTelephonyNumberLookup,
        deleteTelephonyNumberLookup,
      } = await import("../../lib/dynamodb/bot-lookup.repository.js");
      const { assertCanUseVoicebot, assertCanEnableChannel } = await import(
        "../../lib/billing/assert-plan.js"
      );
      const { assertCanEnableKnowledge } = await import("../../lib/billing/plan-config.js");
      const { buildAiAssistantAutoEnableUpdates } = await import(
        "../../lib/ai-assistant/config.js"
      );
      const { normalizeE164 } = await import("../../lib/telnyx/phone.js");

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      const aiAssistantUpdates =
        parsed.data.enabled === true ? buildAiAssistantAutoEnableUpdates(bot) : {};
      if (parsed.data.enabled === true) {
        await assertCanUseVoicebot(tenant);
        await assertCanEnableChannel(tenant, bot, "phone");
      }

      if (parsed.data.telephonyWebhookUrl) {
        await assertSafeUrl(parsed.data.telephonyWebhookUrl);
      }

      const nextNumber = parsed.data.telephonyPhoneNumber
        ? normalizeE164(parsed.data.telephonyPhoneNumber)
        : bot.telephonyPhoneNumber
          ? normalizeE164(bot.telephonyPhoneNumber)
          : "";
      if (parsed.data.enabled === true && !nextNumber) {
        return badRequest("telephonyPhoneNumber is required");
      }

      if (
        bot.telephonyPhoneNumber &&
        nextNumber &&
        bot.telephonyPhoneNumber !== nextNumber
      ) {
        await deleteTelephonyNumberLookup(normalizeE164(bot.telephonyPhoneNumber));
      }

      if (parsed.data.enabled === true && nextNumber) {
        await putTelephonyNumberLookup(nextNumber, auth.tenantId, botId);
      }

      const updates: Record<string, unknown> = { ...aiAssistantUpdates };
      if (parsed.data.enabled !== undefined) updates.telephonyEnabled = parsed.data.enabled;
      if (parsed.data.telephonyPhoneNumber) updates.telephonyPhoneNumber = nextNumber;
      if (parsed.data.telephonyVoiceId !== undefined) {
        updates.telephonyVoiceId = parsed.data.telephonyVoiceId;
      }
      if (parsed.data.telephonyModel !== undefined) {
        updates.telephonyModel = parsed.data.telephonyModel;
      }
      if (parsed.data.telephonyTranscriptionModel !== undefined) {
        updates.telephonyTranscriptionModel = parsed.data.telephonyTranscriptionModel;
      }
      if (parsed.data.telephonyBackgroundSound !== undefined) {
        updates.telephonyBackgroundSound = parsed.data.telephonyBackgroundSound;
      }
      if (parsed.data.telephonyBackgroundSoundVolume !== undefined) {
        updates.telephonyBackgroundSoundVolume = parsed.data.telephonyBackgroundSoundVolume;
      }
      if (parsed.data.telephonyTtsModel !== undefined) {
        updates.telephonyTtsModel = parsed.data.telephonyTtsModel;
      }
      if (parsed.data.telephonyVoiceSpeed !== undefined) {
        updates.telephonyVoiceSpeed = parsed.data.telephonyVoiceSpeed;
      }
      if (parsed.data.telephonyVoiceStability !== undefined) {
        updates.telephonyVoiceStability = parsed.data.telephonyVoiceStability;
      }
      if (parsed.data.telephonyVoiceSimilarity !== undefined) {
        updates.telephonyVoiceSimilarity = parsed.data.telephonyVoiceSimilarity;
      }
      if (parsed.data.telephonyTranscriptionVadThreshold !== undefined) {
        updates.telephonyTranscriptionVadThreshold = parsed.data.telephonyTranscriptionVadThreshold;
      }
      if (parsed.data.telephonyTranscriptionSilenceMs !== undefined) {
        updates.telephonyTranscriptionSilenceMs = parsed.data.telephonyTranscriptionSilenceMs;
      }
      if (parsed.data.telephonyTranscriptionBargeIn !== undefined) {
        updates.telephonyTranscriptionBargeIn = parsed.data.telephonyTranscriptionBargeIn;
      }
      if (parsed.data.telephonyGreeting !== undefined) {
        updates.telephonyGreeting = parsed.data.telephonyGreeting;
      }
      if (parsed.data.telephonySystemPrompt !== undefined) {
        updates.telephonySystemPrompt = parsed.data.telephonySystemPrompt;
      }
      if (parsed.data.telephonyRecordingEnabled !== undefined) {
        updates.telephonyRecordingEnabled = parsed.data.telephonyRecordingEnabled;
      }
      if (parsed.data.telephonyRecordingNotice !== undefined) {
        updates.telephonyRecordingNotice = parsed.data.telephonyRecordingNotice;
      }
      if (parsed.data.telephonyHandoffEnabled !== undefined) {
        updates.telephonyHandoffEnabled = parsed.data.telephonyHandoffEnabled;
      }
      if (parsed.data.telephonyVoiceFlowId !== undefined) {
        updates.telephonyVoiceFlowId = parsed.data.telephonyVoiceFlowId || undefined;
      }
      if (parsed.data.knowledgeEnabled !== undefined) {
        if (parsed.data.knowledgeEnabled) {
          assertCanEnableKnowledge(tenant);
        }
        updates.knowledgeEnabled = parsed.data.knowledgeEnabled;
      }
      if (parsed.data.telephonyWebhookUrl !== undefined) {
        updates.telephonyWebhookUrl = parsed.data.telephonyWebhookUrl;
      }
      if (parsed.data.telephonyWebhookSecret !== undefined && parsed.data.telephonyWebhookSecret) {
        updates.telephonyWebhookSecret = parsed.data.telephonyWebhookSecret;
      }
      if (parsed.data.telephonyWebhookEnabled !== undefined) {
        updates.telephonyWebhookEnabled = parsed.data.telephonyWebhookEnabled;
      }
      if (parsed.data.telephonyWebhookEvents !== undefined) {
        updates.telephonyWebhookEvents = parsed.data.telephonyWebhookEvents;
      }
      if (parsed.data.telephonyStructuredOutput !== undefined) {
        const definition =
          parsed.data.telephonyStructuredOutput === null
            ? null
            : parseStructuredOutputDefinitionInput(parsed.data.telephonyStructuredOutput);
        Object.assign(updates, buildStructuredOutputBotUpdates(definition));
      }
      if (parsed.data.telephonyStructuredOutputs !== undefined) {
        const names = parsed.data.telephonyStructuredOutputs.map((field) => field.name);
        if (names.length !== new Set(names).size) {
          return badRequest("Duplicate structured output field names");
        }
        updates.telephonyStructuredOutputs = parsed.data.telephonyStructuredOutputs;
      }
      if (parsed.data.telephonyStructuredOutputSchemaName !== undefined) {
        const schemaName = parsed.data.telephonyStructuredOutputSchemaName.trim();
        if (schemaName && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schemaName)) {
          return badRequest("Invalid structured output schema name");
        }
        updates.telephonyStructuredOutputSchemaName = schemaName;
      }

      const updated = await updateBot(auth.tenantId, botId, updates);
      const masked = maskWebhookSecret(updated);
      return ok({
        telephonyEnabled: masked?.telephonyEnabled,
        telephonyPhoneNumber: masked?.telephonyPhoneNumber,
        telephonyVoiceId: masked?.telephonyVoiceId,
        telephonyModel: masked?.telephonyModel,
        telephonyTranscriptionModel: masked?.telephonyTranscriptionModel,
        telephonyBackgroundSound: masked?.telephonyBackgroundSound,
        telephonyBackgroundSoundVolume: masked?.telephonyBackgroundSoundVolume,
        telephonyTtsModel: masked?.telephonyTtsModel,
        telephonyVoiceSpeed: masked?.telephonyVoiceSpeed,
        telephonyVoiceStability: masked?.telephonyVoiceStability,
        telephonyVoiceSimilarity: masked?.telephonyVoiceSimilarity,
        telephonyTranscriptionVadThreshold: masked?.telephonyTranscriptionVadThreshold,
        telephonyTranscriptionSilenceMs: masked?.telephonyTranscriptionSilenceMs,
        telephonyTranscriptionBargeIn: Boolean(masked?.telephonyTranscriptionBargeIn),
        telephonyGreeting: masked?.telephonyGreeting,
        telephonySystemPrompt: masked?.telephonySystemPrompt,
        telephonyRecordingEnabled: masked?.telephonyRecordingEnabled,
        telephonyRecordingNotice: masked?.telephonyRecordingNotice,
        telephonyHandoffEnabled: Boolean(masked?.telephonyHandoffEnabled),
        telephonyVoiceFlowId: masked?.telephonyVoiceFlowId ?? "",
        knowledgeEnabled: Boolean(masked?.knowledgeEnabled),
        telephonyWebhookUrl: masked?.telephonyWebhookUrl,
        telephonyWebhookEnabled: masked?.telephonyWebhookEnabled,
        telephonyWebhookEvents: masked?.telephonyWebhookEvents,
        telephonyWebhookSecret: masked?.telephonyWebhookSecret,
        telephonyStructuredOutput: resolveTelephonyStructuredOutput(updated ?? bot),
      });
    }

    if (method === "GET" && rawPath.endsWith("/telephony/tools/secrets")) {
      const names = await listVoiceAgentToolSecretNames(auth.tenantId, ENVIRONMENT, botId);
      return ok({
        secrets: names.map((name) => ({ name, configured: true })),
      });
    }

    if (method === "PUT" && rawPath.endsWith("/telephony/tools/secrets")) {
      const body = VoiceAgentToolSecretSchema.safeParse(parseJsonBody(event));
      if (!body.success) return badRequest(body.error.message);
      await saveVoiceAgentToolSecret(
        auth.tenantId,
        ENVIRONMENT,
        botId,
        body.data.name,
        body.data.value
      );
      return ok({ name: body.data.name, configured: true });
    }

    if (method === "DELETE" && secretName && rawPath.includes("/telephony/tools/secrets/")) {
      const existing = await getVoiceAgentToolSecret(
        auth.tenantId,
        ENVIRONMENT,
        botId,
        secretName
      );
      if (!existing) return notFound("Secret not found");
      await deleteVoiceAgentToolSecret(auth.tenantId, ENVIRONMENT, botId, secretName);
      return noContent();
    }

    if (method === "GET" && rawPath.endsWith("/telephony/tools") && !toolId) {
      const tools = await listVoiceAgentHttpTools(auth.tenantId, botId);
      return ok({ tools: tools.map(serializeVoiceAgentHttpTool) });
    }

    if (method === "POST" && rawPath.endsWith("/telephony/tools") && !toolId) {
      const body = VoiceAgentHttpToolInputSchema.safeParse(parseJsonBody(event));
      if (!body.success) return badRequest(body.error.message);
      const issues = await validateVoiceAgentHttpToolInput({
        tenantId: auth.tenantId,
        botId,
        input: body.data,
        ...(bot.telephonyVoiceFlowId ? { preferredFlowId: bot.telephonyVoiceFlowId } : {}),
        environment: ENVIRONMENT,
      });
      if (issues.length > 0) {
        return badRequest(issues.map((issue) => issue.message).join("; "));
      }
      const existing = await listVoiceAgentHttpTools(auth.tenantId, botId);
      const now = new Date().toISOString();
      const tool = await createVoiceAgentHttpTool({
        tenantId: auth.tenantId,
        botId,
        toolId: makeVoiceAgentToolId(),
        name: body.data.name,
        description: body.data.description,
        httpUrl: body.data.httpUrl,
        httpMethod: body.data.httpMethod,
        parametersJson: body.data.parametersJson ?? "",
        enabled: body.data.enabled ?? true,
        sortOrder: body.data.sortOrder ?? existing.length,
        createdAt: now,
        updatedAt: now,
        ...(body.data.httpBody !== undefined ? { httpBody: body.data.httpBody } : {}),
        ...(body.data.httpHeaders !== undefined ? { httpHeaders: body.data.httpHeaders } : {}),
        ...(body.data.httpResponseVariable !== undefined
          ? { httpResponseVariable: body.data.httpResponseVariable }
          : {}),
        ...(body.data.instruction !== undefined ? { instruction: body.data.instruction } : {}),
      });
      return created(serializeVoiceAgentHttpTool(tool));
    }

    if (toolId && rawPath.includes("/telephony/tools/")) {
      const tool = await getVoiceAgentHttpTool(auth.tenantId, botId, toolId);
      if (!tool) return notFound("Tool not found");

      if (method === "GET" && rawPath.endsWith(`/telephony/tools/${toolId}`)) {
        return ok(serializeVoiceAgentHttpTool(tool));
      }

      if (method === "PUT" && rawPath.endsWith(`/telephony/tools/${toolId}`)) {
        const body = VoiceAgentHttpToolInputSchema.partial().safeParse(parseJsonBody(event));
        if (!body.success) return badRequest(body.error.message);
        const mergedInput = {
          name: body.data.name ?? tool.name,
          description: body.data.description ?? tool.description,
          httpUrl: body.data.httpUrl ?? tool.httpUrl,
          httpMethod: body.data.httpMethod ?? tool.httpMethod,
          httpBody: body.data.httpBody ?? tool.httpBody,
          httpHeaders: body.data.httpHeaders ?? tool.httpHeaders,
          httpResponseVariable: body.data.httpResponseVariable ?? tool.httpResponseVariable,
          parametersJson: body.data.parametersJson ?? tool.parametersJson,
          instruction: body.data.instruction ?? tool.instruction,
          enabled: body.data.enabled ?? tool.enabled,
          sortOrder: body.data.sortOrder ?? tool.sortOrder,
        };
        const issues = await validateVoiceAgentHttpToolInput({
          tenantId: auth.tenantId,
          botId,
          toolId,
          input: mergedInput,
          ...(bot.telephonyVoiceFlowId ? { preferredFlowId: bot.telephonyVoiceFlowId } : {}),
          environment: ENVIRONMENT,
        });
        if (issues.length > 0) {
          return badRequest(issues.map((issue) => issue.message).join("; "));
        }
        const updated = await updateVoiceAgentHttpTool(auth.tenantId, botId, toolId, {
          name: mergedInput.name,
          description: mergedInput.description,
          httpUrl: mergedInput.httpUrl,
          httpMethod: mergedInput.httpMethod,
          parametersJson: mergedInput.parametersJson,
          enabled: mergedInput.enabled,
          sortOrder: mergedInput.sortOrder,
          updatedAt: new Date().toISOString(),
          ...(mergedInput.httpBody !== undefined ? { httpBody: mergedInput.httpBody } : {}),
          ...(mergedInput.httpHeaders !== undefined ? { httpHeaders: mergedInput.httpHeaders } : {}),
          ...(mergedInput.httpResponseVariable !== undefined
            ? { httpResponseVariable: mergedInput.httpResponseVariable }
            : {}),
          ...(mergedInput.instruction !== undefined ? { instruction: mergedInput.instruction } : {}),
        });
        return ok(serializeVoiceAgentHttpTool(updated!));
      }

      if (method === "DELETE" && rawPath.endsWith(`/telephony/tools/${toolId}`)) {
        await deleteVoiceAgentHttpTool(auth.tenantId, botId, toolId);
        return noContent();
      }

      if (method === "POST" && rawPath.endsWith(`/telephony/tools/${toolId}/test`)) {
        const body = VoiceAgentToolTestSchema.safeParse(parseJsonBody(event));
        if (!body.success) return badRequest(body.error.message);
        const result = await buildVoiceAgentToolTestResult({
          tenantId: auth.tenantId,
          botId,
          toolId,
          args: body.data.args ?? {},
          environment: ENVIRONMENT,
          ...(body.data.variables ? { variables: body.data.variables } : {}),
        });
        return ok(result);
      }
    }

    if (method === "GET" && rawPath.endsWith("/telephony/webhook/deliveries")) {
      const deliveries = await listVoiceAgentWebhookDeliveries(auth.tenantId, botId);
      return ok({ deliveries });
    }

    if (method === "POST" && rawPath.endsWith("/telephony/webhook/test")) {
      if (!bot.telephonyWebhookEnabled || !bot.telephonyWebhookUrl) {
        return badRequest("Voice agent webhook is not configured");
      }

      const definition = resolveTelephonyStructuredOutput(bot);
      const endedAt = new Date().toISOString();
      const payload = buildCallTerminatedPayload({
        tenantId: auth.tenantId,
        botId,
        callId: `test-call-${Date.now()}`,
        direction: "USER_INITIATED",
        phoneNumber: "+17875550199",
        status: "completed",
        duration: 185,
        startedAt: new Date(Date.now() - 185_000).toISOString(),
        endedAt,
        ...(bot.telephonyPhoneNumber ? { businessPhoneNumber: bot.telephonyPhoneNumber } : {}),
        ...(definition
          ? {
              structuredOutputs: {
                name: definition.name,
                result: {
                  subtotal: 34.98,
                  impuestos: 4.02,
                  metodo_pago: "tarjeta_credito",
                  valor_total: 42.5,
                  delivery_fee: 3.5,
                  tipo_servicio: "delivery",
                  detalle_pedido: "Pizza grande All Meat con extra queso y una Coca-Cola",
                  nombre_cliente: "Daniel Salcedo",
                  direccion_entrega: "Urbanizacion Hyde Park, calle Muñoz 452, apto 3B",
                  telefono_contacto: "+17875550199",
                  monto_pago_efectivo: "N/A",
                  upsell_ofrecido: false,
                  upsell_aceptado: false,
                  upsell_monto: 0,
                },
              },
            }
          : {}),
      });
      await deliverVoiceAgentWebhook(bot, "call.terminated", payload);
      return ok({ sent: true });
    }

    if (method === "GET" && rawPath.endsWith("/telephony/calls") && !callId) {
      const calls = await listCallsByBot(botId, 50);
      const telnyxCalls = calls.filter((call) => call.provider === "telnyx");
      return ok({ items: telnyxCalls });
    }

    if (method === "GET" && callId && rawPath.endsWith("/events")) {
      const call = await getCallRecord(auth.tenantId, callId);
      if (!call || call.botId !== botId || call.provider !== "telnyx") {
        return notFound("Call not found");
      }
      const events = await listCallEvents(auth.tenantId, callId);
      return ok({ items: events });
    }

    if (method === "GET" && callId && rawPath.endsWith("/recording")) {
      const call = await getCallRecord(auth.tenantId, callId);
      if (!call || call.botId !== botId || call.provider !== "telnyx") {
        return notFound("Call not found");
      }
      if (!call.recordingS3Key || call.recordingStatus !== "ready") {
        return notFound("Recording not available");
      }
      const url = await getPresignedReadUrl(call.recordingS3Key, 900);
      return ok({ url, expiresInSeconds: 900 });
    }

    if (method === "GET" && callId && rawPath.includes("/telephony/calls/")) {
      const call = await getCallRecord(auth.tenantId, callId);
      if (!call || call.botId !== botId || call.provider !== "telnyx") {
        return notFound("Call not found");
      }
      return ok(call);
    }

    if (method === "POST" && rawPath.endsWith("/telephony/calls")) {
      const body = parseJsonBody(event);
      const parsed = OutboundCallSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const result = await startOutboundTelephonyCall({
        tenantId: auth.tenantId,
        botId,
        to: parsed.data.to,
        ...(parsed.data.contactName ? { contactName: parsed.data.contactName } : {}),
      });
      return created(result);
    }

    if (method === "POST" && callId && rawPath.endsWith("/end")) {
      await terminateTelephonyCall(auth.tenantId, callId);
      return ok({ callId, status: "ending" });
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
