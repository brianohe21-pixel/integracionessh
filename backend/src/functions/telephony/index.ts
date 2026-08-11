import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertTenantAccess, assertMemberRole } from "../../lib/auth/cognito.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { listCallsByBot, getCallRecord } from "../../lib/dynamodb/call.repository.js";
import { listCallEvents } from "../../lib/dynamodb/call-event.repository.js";
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
  handleOutboundCallRinging,
  reportCallUsage,
  startOutboundTelephonyCall,
  terminateTelephonyCall,
} from "../../lib/telephony/service.js";
import { deliverVoiceAgentWebhook } from "../../lib/telephony/webhook-delivery.js";
import { executeVoicebotTool } from "../../lib/voicebot/tools.js";
import { getOpenAIApiKey } from "../../lib/ai/providers/openai.js";
import { getPresignedReadUrl } from "../../lib/s3/client.js";
import { assertSafeUrl } from "../../lib/webhook/client.js";
import { buildIntegrationPayload } from "../../lib/integrations/payloads.js";
import type { BotLocale, IntegrationEvent } from "../../types/index.js";
import {
  accepted,
  badRequest,
  created,
  handleError,
  notFound,
  ok,
  parseJsonBody,
  unauthorized,
} from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

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

interface TelephonyGatewayInvokeEvent {
  source: "telephony-gateway";
  action: "execute_tool" | "report_usage";
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
): Promise<{ output?: string; handoff?: boolean; ok?: boolean }> {
  if (event.action === "report_usage" && event.callId) {
    await reportCallUsage({
      tenantId: event.tenantId,
      callId: event.callId,
      usage: event.usage ?? {},
    });
    return { ok: true };
  }

  if (event.action !== "execute_tool" || !event.name || !event.arguments) {
    return { output: JSON.stringify({ error: "Invalid gateway action" }) };
  }

  const bot = await getBot(event.tenantId, event.botId);
  if (!bot) {
    return { output: JSON.stringify({ error: "Bot not found" }) };
  }

  const apiKey = await getOpenAIApiKey(event.tenantId, ENVIRONMENT);
  return executeVoicebotTool(event.name, event.arguments, {
    tenantId: event.tenantId,
    botId: event.botId,
    conversationId: event.conversationId ?? "",
    participantId: event.participantId ?? "",
    locale: event.locale ?? "es",
    knowledgeEnabled: Boolean(bot.knowledgeEnabled),
    apiKey,
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
): Promise<APIGatewayProxyResultV2 | { output?: string; handoff?: boolean; ok?: boolean }> {
  try {
    if (isGatewayInvokeEvent(event)) {
      return handleGatewayInvoke(event);
    }

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const botId = event.pathParameters?.botId;
    const callId = event.pathParameters?.callId;

    const credentialTenantId = event.pathParameters?.credentialTenantId;

    if (method === "POST" && rawPath === "/telephony/webhook") {
      return handleTelnyxWebhook(event);
    }

    if (method === "POST" && credentialTenantId && rawPath.startsWith("/telephony/webhook/")) {
      return handleTelnyxWebhook(event, credentialTenantId);
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
        telephonyModel: bot.telephonyModel ?? bot.voicebotModel ?? "gpt-realtime-2.1-mini",
        telephonyGreeting: bot.telephonyGreeting ?? "",
        telephonySystemPrompt:
          bot.telephonySystemPrompt ?? bot.voicebotSystemPrompt ?? bot.systemPrompt ?? "",
        telephonyRecordingEnabled: Boolean(bot.telephonyRecordingEnabled),
        telephonyRecordingNotice: bot.telephonyRecordingNotice ?? "",
        telephonyWebhookUrl: bot.telephonyWebhookUrl ?? "",
        telephonyWebhookEnabled: Boolean(bot.telephonyWebhookEnabled),
        telephonyWebhookEvents: bot.telephonyWebhookEvents ?? VOICE_AGENT_WEBHOOK_EVENTS,
        telephonyWebhookSecret: bot.telephonyWebhookSecret ? "***" : undefined,
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
          telephonyGreeting: z.string().max(500).optional(),
          telephonySystemPrompt: z.string().max(8000).optional(),
          telephonyRecordingEnabled: z.boolean().optional(),
          telephonyRecordingNotice: z.string().max(500).optional(),
          telephonyWebhookUrl: z.string().max(2048).optional(),
          telephonyWebhookSecret: z.string().max(256).optional(),
          telephonyWebhookEnabled: z.boolean().optional(),
          telephonyWebhookEvents: z.array(z.string()).optional(),
        })
        .safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const { ensureTenant } = await import("../../lib/dynamodb/tenant.repository.js");
      const { updateBot } = await import("../../lib/dynamodb/bot.repository.js");
      const {
        putTelephonyNumberLookup,
        deleteTelephonyNumberLookup,
      } = await import("../../lib/dynamodb/bot-lookup.repository.js");
      const { assertCanUseVoicebot, assertCanEnableChannel } = await import(
        "../../lib/billing/assert-plan.js"
      );
      const { assertAiAssistantActive } = await import("../../lib/ai-assistant/config.js");
      const { normalizeE164 } = await import("../../lib/telnyx/phone.js");

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      if (parsed.data.enabled === true) {
        assertAiAssistantActive(bot);
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

      const updates: Record<string, unknown> = {};
      if (parsed.data.enabled !== undefined) updates.telephonyEnabled = parsed.data.enabled;
      if (parsed.data.telephonyPhoneNumber) updates.telephonyPhoneNumber = nextNumber;
      if (parsed.data.telephonyVoiceId !== undefined) {
        updates.telephonyVoiceId = parsed.data.telephonyVoiceId;
      }
      if (parsed.data.telephonyModel !== undefined) {
        updates.telephonyModel = parsed.data.telephonyModel;
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

      const updated = await updateBot(auth.tenantId, botId, updates);
      const masked = maskWebhookSecret(updated);
      return ok({
        telephonyEnabled: masked?.telephonyEnabled,
        telephonyPhoneNumber: masked?.telephonyPhoneNumber,
        telephonyVoiceId: masked?.telephonyVoiceId,
        telephonyModel: masked?.telephonyModel,
        telephonyGreeting: masked?.telephonyGreeting,
        telephonySystemPrompt: masked?.telephonySystemPrompt,
        telephonyRecordingEnabled: masked?.telephonyRecordingEnabled,
        telephonyRecordingNotice: masked?.telephonyRecordingNotice,
        telephonyWebhookUrl: masked?.telephonyWebhookUrl,
        telephonyWebhookEnabled: masked?.telephonyWebhookEnabled,
        telephonyWebhookEvents: masked?.telephonyWebhookEvents,
        telephonyWebhookSecret: masked?.telephonyWebhookSecret,
      });
    }

    if (method === "GET" && rawPath.endsWith("/telephony/webhook/deliveries")) {
      const deliveries = await listVoiceAgentWebhookDeliveries(auth.tenantId, botId);
      return ok({ deliveries });
    }

    if (method === "POST" && rawPath.endsWith("/telephony/webhook/test")) {
      if (!bot.telephonyWebhookEnabled || !bot.telephonyWebhookUrl) {
        return badRequest("Voice agent webhook is not configured");
      }
      const payload = buildIntegrationPayload({
        event: "call.status",
        tenantId: auth.tenantId,
        data: {
          botId,
          callId: "test-call-id",
          status: "accepted",
          phoneNumber: "+10000000000",
        },
      });
      await deliverVoiceAgentWebhook(bot, "call.status", payload);
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
