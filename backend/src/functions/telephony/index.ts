import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertTenantAccess, assertMemberRole } from "../../lib/auth/cognito.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { listCallsByBot, getCallRecord } from "../../lib/dynamodb/call.repository.js";
import { hasTelnyxCredentials } from "../../lib/telnyx/secrets.js";
import { listOwnedPhoneNumbers } from "../../lib/telnyx/client.js";
import { listElevenLabsVoices } from "../../lib/telnyx/elevenlabs.js";
import { parseTelnyxWebhookBody, verifyTelnyxWebhookSignature } from "../../lib/telnyx/webhook.js";
import { markTelnyxEventProcessed } from "../../lib/telnyx/idempotency.js";
import { getTelnyxSecrets } from "../../lib/telnyx/secrets.js";
import {
  handleCallAnswered,
  handleCallHangup,
  handleInboundCallInitiated,
  startOutboundTelephonyCall,
  terminateTelephonyCall,
} from "../../lib/telephony/service.js";
import { executeVoicebotTool } from "../../lib/voicebot/tools.js";
import { getOpenAIApiKey } from "../../lib/ai/providers/openai.js";
import type { BotLocale } from "../../types/index.js";
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

const OutboundCallSchema = z.object({
  to: z.string().min(7).max(20),
  contactName: z.string().max(120).optional(),
});

interface TelephonyGatewayInvokeEvent {
  source: "telephony-gateway";
  action: "execute_tool";
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  locale: BotLocale;
  name: string;
  arguments: string;
}

function isGatewayInvokeEvent(event: unknown): event is TelephonyGatewayInvokeEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as TelephonyGatewayInvokeEvent).source === "telephony-gateway" &&
    (event as TelephonyGatewayInvokeEvent).action === "execute_tool"
  );
}

async function handleGatewayToolInvoke(
  event: TelephonyGatewayInvokeEvent
): Promise<{ output: string; handoff?: boolean }> {
  const bot = await getBot(event.tenantId, event.botId);
  if (!bot) {
    return { output: JSON.stringify({ error: "Bot not found" }) };
  }

  const apiKey = await getOpenAIApiKey(event.tenantId, ENVIRONMENT);
  return executeVoicebotTool(event.name, event.arguments, {
    tenantId: event.tenantId,
    botId: event.botId,
    conversationId: event.conversationId,
    participantId: event.participantId,
    locale: event.locale,
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

async function handleTelnyxWebhook(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const rawBody = getRawBody(event);
  const secrets = await getTelnyxSecrets(ENVIRONMENT);
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

    if (eventType === "call.initiated") {
      const direction = String(payload.direction ?? "");
      if (direction === "incoming") {
        await handleInboundCallInitiated(payload);
      }
      continue;
    }

    if (eventType === "call.answered") {
      await handleCallAnswered(payload);
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
): Promise<APIGatewayProxyResultV2 | { output: string; handoff?: boolean }> {
  try {
    if (isGatewayInvokeEvent(event)) {
      return handleGatewayToolInvoke(event);
    }

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const botId = event.pathParameters?.botId;
    const callId = event.pathParameters?.callId;

    if (method === "POST" && rawPath === "/telephony/webhook") {
      return handleTelnyxWebhook(event);
    }

    const auth = await resolveRequestAuth(event as APIGatewayProxyEventV2WithJWTAuthorizer);
    assertMemberRole(auth);

    if (method === "GET" && rawPath === "/telephony/numbers") {
      const configured = await hasTelnyxCredentials(ENVIRONMENT);
      if (!configured) return ok({ numbers: [] });
      const numbers = await listOwnedPhoneNumbers(ENVIRONMENT);
      return ok({ numbers });
    }

    if (method === "GET" && rawPath === "/telephony/voices") {
      try {
        const voices = await listElevenLabsVoices(ENVIRONMENT);
        return ok({ voices });
      } catch {
        return ok({
          voices: [{ id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" }],
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
        telephonySystemPrompt: bot.telephonySystemPrompt ?? bot.voicebotSystemPrompt ?? bot.systemPrompt ?? "",
      });
    }

    if (method === "PUT" && rawPath.endsWith("/telephony/settings")) {
      const body = parseJsonBody(event);
      const parsed = z
        .object({
          enabled: z.boolean().optional(),
          telephonyPhoneNumber: z.string().min(7).max(20).optional(),
          telephonyVoiceId: z.string().min(1).max(64).optional(),
          telephonyModel: z.string().min(3).max(64).optional(),
          telephonyGreeting: z.string().max(500).optional(),
          telephonySystemPrompt: z.string().max(4096).optional(),
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

      const updated = await updateBot(auth.tenantId, botId, updates);
      return ok({
        telephonyEnabled: updated.telephonyEnabled,
        telephonyPhoneNumber: updated.telephonyPhoneNumber,
        telephonyVoiceId: updated.telephonyVoiceId,
        telephonyModel: updated.telephonyModel,
        telephonyGreeting: updated.telephonyGreeting,
        telephonySystemPrompt: updated.telephonySystemPrompt,
      });
    }

    if (method === "GET" && rawPath.endsWith("/telephony/calls") && !callId) {
      const calls = await listCallsByBot(botId, 50);
      const telnyxCalls = calls.filter((call) => call.provider === "telnyx");
      return ok({ items: telnyxCalls });
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
