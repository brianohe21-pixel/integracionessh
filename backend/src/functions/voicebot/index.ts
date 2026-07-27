import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getBotByVoicebotWidgetKey } from "../../lib/dynamodb/bot-lookup.repository.js";
import { getOrCreateConversation } from "../../lib/dynamodb/conversation.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanStartVoicebotSession } from "../../lib/billing/assert-plan.js";
import { getOpenAIApiKey } from "../../lib/ai/providers/openai.js";
import { startRealtimeCall } from "../../lib/voicebot/realtime-client.js";
import { buildRealtimeSessionConfig } from "../../lib/voicebot/realtime-config.js";
import { createVoicebotSession, endVoicebotSession, getVoicebotSession } from "../../lib/voicebot/session.repository.js";
import { ok, created, badRequest, unauthorized, notFound, handleError } from "../../lib/http.js";
import type { BotLocale } from "../../types/index.js";

const lambda = new LambdaClient({});
const SESSION_FUNCTION = process.env.VOICEBOT_SESSION_FUNCTION_NAME ?? "";
const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const CreateSessionSchema = z.object({
  botId: z.string().uuid(),
  sdpOffer: z.string().min(1),
  visitorName: z.string().max(120).optional(),
});

const EndSessionSchema = z.object({
  durationSeconds: z.number().int().min(0).max(86400).optional(),
});

function getWidgetKey(event: APIGatewayProxyEventV2): string | undefined {
  return event.headers["x-widget-key"] ?? event.headers["X-Widget-Key"];
}

function parseSubPath(rawPath: string, sessionId: string): string[] {
  const suffix = rawPath.split(`/voicebot/sessions/${sessionId}`)[1] ?? "";
  return suffix.replace(/^\//, "").split("/").filter(Boolean);
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const sessionId = event.pathParameters?.sessionId;

    if (method === "POST" && rawPath.endsWith("/voicebot/sessions") && !sessionId) {
      return handleCreateSession(event);
    }

    if (!sessionId) return badRequest("Route not found");

    const sub = parseSubPath(rawPath, sessionId);
    if (method === "POST" && sub[0] === "end") {
      return handleEndSession(event, sessionId);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}

async function handleCreateSession(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const widgetKey = getWidgetKey(event);
  if (!widgetKey) return unauthorized("Missing X-Widget-Key");

  const lookup = await getBotByVoicebotWidgetKey(widgetKey);
  if (!lookup) return unauthorized("Invalid widget key");

  const body = JSON.parse(event.body ?? "{}");
  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  if (parsed.data.botId !== lookup.botId) {
    return unauthorized("Widget key does not match bot");
  }

  const bot = await getBot(lookup.tenantId, lookup.botId);
  if (!bot || !bot.voicebotEnabled) {
    return badRequest("Voicebot not enabled for this bot");
  }

  if (bot.responseMode !== "openai") {
    return badRequest("Voicebot requires OpenAI response mode");
  }

  const tenant = await getTenant(lookup.tenantId);
  if (!tenant) return badRequest("Tenant not found");
  await assertCanStartVoicebotSession(tenant);

  const sessionId = randomUUID();
  const participantId = `visitor-${sessionId}`;
  const locale: BotLocale = bot.defaultLocale ?? "es";

  const conversation = await getOrCreateConversation(
    lookup.tenantId,
    lookup.botId,
    "voicebot",
    participantId,
    parsed.data.visitorName
  );

  const sessionConfig = await buildRealtimeSessionConfig({
    bot,
    tenantId: lookup.tenantId,
    locale,
  });

  const apiKey = await getOpenAIApiKey(lookup.tenantId, ENVIRONMENT);
  const call = await startRealtimeCall({
    apiKey,
    sdpOffer: parsed.data.sdpOffer,
    sessionConfig,
  });

  await createVoicebotSession({
    sessionId,
    callId: call.callId,
    tenantId: lookup.tenantId,
    botId: lookup.botId,
    conversationId: conversation.conversationId,
    participantId,
    ...(call.ephemeralKey ? { ephemeralKey: call.ephemeralKey } : {}),
    ...(parsed.data.visitorName ? { visitorName: parsed.data.visitorName } : {}),
  });

  if (SESSION_FUNCTION) {
    await lambda.send(
      new InvokeCommand({
        FunctionName: SESSION_FUNCTION,
        InvocationType: "Event",
        Payload: Buffer.from(
          JSON.stringify({
            sessionId,
            callId: call.callId,
            tenantId: lookup.tenantId,
            botId: lookup.botId,
            conversationId: conversation.conversationId,
            participantId,
            locale,
            ...(call.ephemeralKey ? { ephemeralKey: call.ephemeralKey } : {}),
            ...(bot.voicebotGreeting ? { greeting: bot.voicebotGreeting } : {}),
          })
        ),
      })
    );
  }

  return created({
    sessionId,
    conversationId: conversation.conversationId,
    sdpAnswer: call.sdpAnswer,
    callId: call.callId,
  });
}

async function handleEndSession(
  event: APIGatewayProxyEventV2,
  sessionId: string
): Promise<APIGatewayProxyResultV2> {
  const widgetKey = getWidgetKey(event);
  if (!widgetKey) return unauthorized("Missing X-Widget-Key");

  const lookup = await getBotByVoicebotWidgetKey(widgetKey);
  if (!lookup) return unauthorized("Invalid widget key");

  const session = await getVoicebotSession(sessionId);
  if (!session || session.tenantId !== lookup.tenantId) {
    return notFound("Session not found");
  }

  const body = JSON.parse(event.body ?? "{}");
  const parsed = EndSessionSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  if (session.status === "ended") {
    return ok({ sessionId, status: "ended", durationSeconds: session.durationSeconds ?? 0 });
  }

  const startedMs = new Date(session.startedAt).getTime();
  const durationSeconds =
    parsed.data.durationSeconds ??
    Math.max(1, Math.ceil((Date.now() - startedMs) / 1000));

  const updated = await endVoicebotSession(sessionId, durationSeconds);
  return ok({
    sessionId,
    status: updated?.status ?? "ended",
    durationSeconds,
  });
}
