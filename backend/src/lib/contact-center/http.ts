import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  assertAdvisorOrMember,
  assertMemberRole,
  resolveRequestAuth,
} from "../auth/cognito.js";
import { getAdvisorByCognitoUserId, listAdvisors, updateAdvisor } from "../dynamodb/advisor.repository.js";
import {
  deleteContactCenterIvrFlow,
  getContactCenterIvrFlow,
  listContactCenterIvrFlows,
  putContactCenterIvrFlow,
} from "../dynamodb/contact-center-ivr.repository.js";
import {
  deleteContactCenterQueue,
  getContactCenterQueue,
  listContactCenterQueues,
  putContactCenterQueue,
} from "../dynamodb/contact-center-queue.repository.js";
import { getBot, updateBot } from "../dynamodb/bot.repository.js";
import {
  getVoiceCampaign,
  listVoiceCampaignAttempts,
  listVoiceCampaigns,
  putVoiceCampaign,
} from "../dynamodb/voice-campaign.repository.js";
import { getAgentPresence } from "../dynamodb/agent-presence.repository.js";
import { listQueueMemberships } from "../dynamodb/queue-membership.repository.js";
import {
  badRequest,
  created,
  forbidden,
  handleError,
  noContent,
  notFound,
  ok,
  parseJsonBody,
} from "../http.js";
import { generateCallCopilotSummary } from "./copilot.js";
import {
  ensurePresenceCredential,
  issueSoftphoneToken,
  updatePresenceState,
} from "./presence.js";
import {
  completeWarmTransfer,
  dispatchQueue,
  holdLiveCall,
  refreshStaleAgentsAndDispatch,
  requestCallback,
  setCallDisposition,
  startPreviewOutbound,
  superviseCall,
  transferCallToQueue,
  tryDialNextCampaignRecipient,
} from "./service.js";
import { buildWallboard } from "./wallboard.js";
import { canStartCampaign } from "./campaigns.js";
import type { AgentPresenceState, SupervisorRole } from "../../types/index.js";

const QueueSchema = z.object({
  botId: z.string().uuid(),
  name: z.string().min(1).max(80),
  strategy: z.enum(["longest_idle", "round_robin", "fewest_calls"]).optional(),
  skills: z.array(z.string().min(1).max(40)).max(20).optional(),
  slaSeconds: z.number().int().min(5).max(3600).optional(),
  maxWaitSeconds: z.number().int().min(10).max(7200).optional(),
  holdAudioUrl: z.string().url().max(2048).optional(),
  overflowQueueId: z.string().uuid().optional(),
  afterHoursAction: z.enum(["ai", "voicemail", "hangup"]).optional(),
  announcePosition: z.boolean().optional(),
  callbackEnabled: z.boolean().optional(),
  wrapUpSeconds: z.number().int().min(0).max(600).optional(),
  hours: z
    .object({
      timezone: z.string().min(1).max(64),
      days: z.record(z.object({ start: z.string(), end: z.string() }).nullable()),
    })
    .optional(),
});

const IvrSchema = z.object({
  botId: z.string().uuid(),
  name: z.string().min(1).max(80),
  entryNodeId: z.string().min(1).max(64),
  nodes: z
    .array(
      z.object({
        nodeId: z.string().min(1).max(64),
        type: z.enum(["menu", "queue", "ai", "hangup", "voicemail"]),
        prompt: z.string().max(500).optional(),
        queueId: z.string().uuid().optional(),
        timeoutSeconds: z.number().int().min(3).max(30).optional(),
        options: z
          .array(
            z.object({
              digit: z.string().min(1).max(2),
              targetType: z.enum(["menu", "queue", "ai", "hangup", "voicemail"]),
              targetId: z.string().max(64).optional(),
            })
          )
          .max(12)
          .optional(),
      })
    )
    .min(1)
    .max(30),
});

const PresenceSchema = z.object({
  state: z.enum(["offline", "available", "ringing", "on_call", "wrap_up", "break"]).optional(),
  webrtcConnected: z.boolean().optional(),
  skills: z.array(z.string().min(1).max(40)).max(20).optional(),
  queueIds: z.array(z.string().uuid()).max(20).optional(),
});

const RoutingSchema = z.object({
  telephonyRoutingMode: z.enum(["ai", "ivr", "queue"]),
  telephonyQueueId: z.string().uuid().optional().or(z.literal("")),
  telephonyIvrFlowId: z.string().uuid().optional().or(z.literal("")),
});

function pathAfter(rawPath: string): string {
  const index = rawPath.indexOf("/contact-center");
  if (index < 0) return rawPath;
  return rawPath.slice(index + "/contact-center".length) || "/";
}

async function resolveAgentId(
  auth: { tenantId: string; userId: string; role: string }
): Promise<string> {
  if (auth.role === "advisor") {
    const advisor = await getAdvisorByCognitoUserId(auth.tenantId, auth.userId);
    if (!advisor) throw Object.assign(new Error("Advisor profile not found"), { statusCode: 404 });
    return advisor.advisorId;
  }
  return `member-${auth.userId}`;
}

export async function handleContactCenterHttp(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    assertAdvisorOrMember(auth);
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const path = pathAfter(rawPath);
    const body = parseJsonBody(event);

    if (path === "/me/token" && method === "POST") {
      const agentId = await resolveAgentId(auth);
      const kind = auth.role === "advisor" ? "advisor" : "member";
      await ensurePresenceCredential({
        tenantId: auth.tenantId,
        advisorId: agentId,
        cognitoUserId: auth.userId,
        kind,
      });
      const token = await issueSoftphoneToken({ tenantId: auth.tenantId, advisorId: agentId });
      return ok(token);
    }

    if (path === "/me/presence" && method === "GET") {
      const agentId = await resolveAgentId(auth);
      const presence = await getAgentPresence(auth.tenantId, agentId);
      return ok(presence ?? { advisorId: agentId, state: "offline", queueIds: [], skills: [] });
    }

    if (path === "/me/presence" && method === "PUT") {
      const parsed = PresenceSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const agentId = await resolveAgentId(auth);
      const kind = auth.role === "advisor" ? "advisor" : "member";
      await ensurePresenceCredential({
        tenantId: auth.tenantId,
        advisorId: agentId,
        cognitoUserId: auth.userId,
        kind,
      });
      const presence = await updatePresenceState({
        tenantId: auth.tenantId,
        advisorId: agentId,
        ...(parsed.data.state ? { state: parsed.data.state as AgentPresenceState } : {}),
        ...(parsed.data.webrtcConnected !== undefined
          ? { webrtcConnected: parsed.data.webrtcConnected }
          : {}),
        ...(parsed.data.skills ? { skills: parsed.data.skills } : {}),
        ...(parsed.data.queueIds ? { queueIds: parsed.data.queueIds } : {}),
        heartbeat: true,
      });
      await refreshStaleAgentsAndDispatch(auth.tenantId);
      if (presence.state === "available") {
        for (const queueId of presence.queueIds) {
          await dispatchQueue(auth.tenantId, queueId);
        }
      }
      return ok(presence);
    }

    if (path === "/calls/outbound" && method === "POST") {
      const parsed = z
        .object({
          botId: z.string().uuid(),
          to: z.string().min(7).max(20),
          campaignId: z.string().uuid().optional(),
        })
        .safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const agentId = await resolveAgentId(auth);
      const result = await startPreviewOutbound({
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        advisorId: agentId,
        to: parsed.data.to,
        ...(parsed.data.campaignId ? { campaignId: parsed.data.campaignId } : {}),
      });
      return created(result);
    }

    const callMatch = path.match(/^\/calls\/([^/]+)(?:\/(.*))?$/);
    if (callMatch) {
      const callId = callMatch[1];
      const action = callMatch[2] ?? "";
      if (action === "hold" && method === "POST") {
        const parsed = z.object({ hold: z.boolean() }).safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);
        await holdLiveCall({ tenantId: auth.tenantId, callId, hold: parsed.data.hold });
        return ok({ ok: true });
      }
      if (action === "transfer" && method === "POST") {
        const parsed = z
          .object({
            targetQueueId: z.string().uuid().optional(),
            targetAdvisorId: z.string().min(1).optional(),
            warm: z.boolean().optional(),
          })
          .safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);
        await transferCallToQueue({
          tenantId: auth.tenantId,
          callId,
          ...(parsed.data.targetQueueId ? { targetQueueId: parsed.data.targetQueueId } : {}),
          ...(parsed.data.targetAdvisorId ? { targetAdvisorId: parsed.data.targetAdvisorId } : {}),
          warm: Boolean(parsed.data.warm),
        });
        return ok({ ok: true });
      }
      if (action === "transfer/complete" && method === "POST") {
        await completeWarmTransfer({ tenantId: auth.tenantId, callId });
        return ok({ ok: true });
      }
      if (action === "supervise" && method === "POST") {
        assertMemberRole(auth);
        const parsed = z
          .object({ role: z.enum(["monitor", "whisper", "barge"]) })
          .safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);
        const supervisorId = await resolveAgentId(auth);
        await superviseCall({
          tenantId: auth.tenantId,
          callId,
          supervisorId,
          role: parsed.data.role as SupervisorRole,
        });
        return ok({ ok: true });
      }
      if (action === "disposition" && method === "PUT") {
        const parsed = z.object({ disposition: z.string().min(1).max(64) }).safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);
        await setCallDisposition({
          tenantId: auth.tenantId,
          callId,
          disposition: parsed.data.disposition,
        });
        return ok({ ok: true });
      }
      if (action === "callback" && method === "POST") {
        const parsed = z.object({ phoneNumber: z.string().min(7).max(20).optional() }).safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);
        await requestCallback({
          tenantId: auth.tenantId,
          callId,
          ...(parsed.data.phoneNumber ? { phoneNumber: parsed.data.phoneNumber } : {}),
        });
        return ok({ ok: true });
      }
      if (action === "copilot" && method === "POST") {
        const summary = await generateCallCopilotSummary({
          tenantId: auth.tenantId,
          callId,
        });
        return ok(summary);
      }
    }

    if (path === "/wallboard" && method === "GET") {
      assertMemberRole(auth);
      return ok(await buildWallboard(auth.tenantId));
    }

    if (path.startsWith("/queues") || path.startsWith("/ivr") || path.startsWith("/campaigns") || path.startsWith("/routing") || path.startsWith("/advisors")) {
      assertMemberRole(auth);
    }

    if (path === "/queues" && method === "GET") {
      const botId = event.queryStringParameters?.botId;
      return ok({ items: await listContactCenterQueues(auth.tenantId, botId) });
    }

    if (path === "/queues" && method === "POST") {
      const parsed = QueueSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const bot = await getBot(auth.tenantId, parsed.data.botId);
      if (!bot) return notFound("Bot not found");
      const now = new Date().toISOString();
      const queue = await putContactCenterQueue({
        queueId: randomUUID(),
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        name: parsed.data.name,
        strategy: parsed.data.strategy ?? "longest_idle",
        skills: parsed.data.skills ?? [],
        slaSeconds: parsed.data.slaSeconds ?? 30,
        afterHoursAction: parsed.data.afterHoursAction ?? "ai",
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.maxWaitSeconds !== undefined
          ? { maxWaitSeconds: parsed.data.maxWaitSeconds }
          : {}),
        ...(parsed.data.holdAudioUrl ? { holdAudioUrl: parsed.data.holdAudioUrl } : {}),
        ...(parsed.data.overflowQueueId ? { overflowQueueId: parsed.data.overflowQueueId } : {}),
        ...(parsed.data.announcePosition !== undefined
          ? { announcePosition: parsed.data.announcePosition }
          : {}),
        ...(parsed.data.callbackEnabled !== undefined
          ? { callbackEnabled: parsed.data.callbackEnabled }
          : {}),
        ...(parsed.data.wrapUpSeconds !== undefined
          ? { wrapUpSeconds: parsed.data.wrapUpSeconds }
          : {}),
        ...(parsed.data.hours ? { hours: parsed.data.hours } : {}),
      });
      return created(queue);
    }

    const queueMatch = path.match(/^\/queues\/([^/]+)$/);
    if (queueMatch && method === "GET") {
      const queue = await getContactCenterQueue(auth.tenantId, queueMatch[1]);
      if (!queue) return notFound("Queue not found");
      const waiting = await listQueueMemberships(auth.tenantId, queue.queueId);
      return ok({ ...queue, waiting: waiting.length });
    }
    if (queueMatch && method === "PUT") {
      const existing = await getContactCenterQueue(auth.tenantId, queueMatch[1]);
      if (!existing) return notFound("Queue not found");
      const parsed = QueueSchema.partial().safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const updated = await putContactCenterQueue({
        ...existing,
        queueId: existing.queueId,
        tenantId: existing.tenantId,
        botId: parsed.data.botId ?? existing.botId,
        name: parsed.data.name ?? existing.name,
        strategy: parsed.data.strategy ?? existing.strategy,
        skills: parsed.data.skills ?? existing.skills,
        slaSeconds: parsed.data.slaSeconds ?? existing.slaSeconds,
        afterHoursAction: parsed.data.afterHoursAction ?? existing.afterHoursAction,
        updatedAt: new Date().toISOString(),
        ...(parsed.data.maxWaitSeconds !== undefined
          ? { maxWaitSeconds: parsed.data.maxWaitSeconds }
          : {}),
        ...(parsed.data.holdAudioUrl ? { holdAudioUrl: parsed.data.holdAudioUrl } : {}),
        ...(parsed.data.overflowQueueId ? { overflowQueueId: parsed.data.overflowQueueId } : {}),
        ...(parsed.data.announcePosition !== undefined
          ? { announcePosition: parsed.data.announcePosition }
          : {}),
        ...(parsed.data.callbackEnabled !== undefined
          ? { callbackEnabled: parsed.data.callbackEnabled }
          : {}),
        ...(parsed.data.wrapUpSeconds !== undefined
          ? { wrapUpSeconds: parsed.data.wrapUpSeconds }
          : {}),
        ...(parsed.data.hours ? { hours: parsed.data.hours } : {}),
      });
      return ok(updated);
    }
    if (queueMatch && method === "DELETE") {
      await deleteContactCenterQueue(auth.tenantId, queueMatch[1]);
      return noContent();
    }

    if (path === "/ivr" && method === "GET") {
      const botId = event.queryStringParameters?.botId;
      return ok({ items: await listContactCenterIvrFlows(auth.tenantId, botId) });
    }
    if (path === "/ivr" && method === "POST") {
      const parsed = IvrSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const now = new Date().toISOString();
      const flow = await putContactCenterIvrFlow({
        ivrFlowId: randomUUID(),
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        name: parsed.data.name,
        entryNodeId: parsed.data.entryNodeId,
        nodes: parsed.data.nodes.map((node) => ({
          nodeId: node.nodeId,
          type: node.type,
          ...(node.prompt ? { prompt: node.prompt } : {}),
          ...(node.queueId ? { queueId: node.queueId } : {}),
          ...(node.timeoutSeconds !== undefined ? { timeoutSeconds: node.timeoutSeconds } : {}),
          ...(node.options
            ? {
                options: node.options.map((option) => ({
                  digit: option.digit,
                  targetType: option.targetType,
                  ...(option.targetId ? { targetId: option.targetId } : {}),
                })),
              }
            : {}),
        })),
        createdAt: now,
        updatedAt: now,
      });
      return created(flow);
    }
    const ivrMatch = path.match(/^\/ivr\/([^/]+)$/);
    if (ivrMatch && method === "GET") {
      const flow = await getContactCenterIvrFlow(auth.tenantId, ivrMatch[1]);
      if (!flow) return notFound("IVR not found");
      return ok(flow);
    }
    if (ivrMatch && method === "PUT") {
      const existing = await getContactCenterIvrFlow(auth.tenantId, ivrMatch[1]);
      if (!existing) return notFound("IVR not found");
      const parsed = IvrSchema.partial().safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const updated = await putContactCenterIvrFlow({
        ...existing,
        ivrFlowId: existing.ivrFlowId,
        tenantId: existing.tenantId,
        botId: parsed.data.botId ?? existing.botId,
        name: parsed.data.name ?? existing.name,
        entryNodeId: parsed.data.entryNodeId ?? existing.entryNodeId,
        nodes: parsed.data.nodes
          ? parsed.data.nodes.map((node) => ({
              nodeId: node.nodeId,
              type: node.type,
              ...(node.prompt ? { prompt: node.prompt } : {}),
              ...(node.queueId ? { queueId: node.queueId } : {}),
              ...(node.timeoutSeconds !== undefined ? { timeoutSeconds: node.timeoutSeconds } : {}),
              ...(node.options
                ? {
                    options: node.options.map((option) => ({
                      digit: option.digit,
                      targetType: option.targetType,
                      ...(option.targetId ? { targetId: option.targetId } : {}),
                    })),
                  }
                : {}),
            }))
          : existing.nodes,
        updatedAt: new Date().toISOString(),
      });
      return ok(updated);
    }
    if (ivrMatch && method === "DELETE") {
      await deleteContactCenterIvrFlow(auth.tenantId, ivrMatch[1]);
      return noContent();
    }

    const routingMatch = path.match(/^\/routing\/([^/]+)$/);
    if (routingMatch && method === "PUT") {
      const parsed = RoutingSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const bot = await getBot(auth.tenantId, routingMatch[1]);
      if (!bot) return notFound("Bot not found");
      const updated = await updateBot(auth.tenantId, routingMatch[1], {
        telephonyRoutingMode: parsed.data.telephonyRoutingMode,
        ...(parsed.data.telephonyQueueId
          ? { telephonyQueueId: parsed.data.telephonyQueueId }
          : {}),
        ...(parsed.data.telephonyIvrFlowId
          ? { telephonyIvrFlowId: parsed.data.telephonyIvrFlowId }
          : {}),
      });
      return ok({
        telephonyRoutingMode: updated.telephonyRoutingMode ?? "ai",
        telephonyQueueId: updated.telephonyQueueId ?? "",
        telephonyIvrFlowId: updated.telephonyIvrFlowId ?? "",
      });
    }

    if (path === "/advisors/voice" && method === "PUT") {
      const parsed = z
        .object({
          advisorId: z.string().uuid(),
          queueIds: z.array(z.string().uuid()).max(20),
          skills: z.array(z.string().min(1).max(40)).max(20).optional(),
          voiceEnabled: z.boolean().optional(),
        })
        .safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const updated = await updateAdvisor(auth.tenantId, parsed.data.advisorId, {
        queueIds: parsed.data.queueIds,
        ...(parsed.data.skills ? { skills: parsed.data.skills } : {}),
        ...(parsed.data.voiceEnabled !== undefined
          ? { voiceEnabled: parsed.data.voiceEnabled }
          : {}),
      });
      if (!updated) return notFound("Advisor not found");
      await ensurePresenceCredential({
        tenantId: auth.tenantId,
        advisorId: updated.advisorId,
        queueIds: parsed.data.queueIds,
        skills: parsed.data.skills ?? updated.skills ?? [],
        kind: "advisor",
      });
      await updatePresenceState({
        tenantId: auth.tenantId,
        advisorId: updated.advisorId,
        queueIds: parsed.data.queueIds,
        skills: parsed.data.skills ?? updated.skills ?? [],
      });
      return ok(updated);
    }

    if (path === "/campaigns" && method === "GET") {
      const botId = event.queryStringParameters?.botId;
      return ok({ items: await listVoiceCampaigns(auth.tenantId, botId) });
    }
    if (path === "/campaigns" && method === "POST") {
      const parsed = z
        .object({
          botId: z.string().uuid(),
          name: z.string().min(1).max(80),
          mode: z.enum(["preview", "progressive"]),
          fromNumber: z.string().min(7).max(20),
          queueId: z.string().uuid(),
          recipients: z.array(z.string().min(7).max(20)).min(1).max(5000),
          amdEnabled: z.boolean().optional(),
        })
        .safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);
      const now = new Date().toISOString();
      const campaign = await putVoiceCampaign({
        campaignId: randomUUID(),
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        name: parsed.data.name,
        mode: parsed.data.mode,
        status: "draft",
        fromNumber: parsed.data.fromNumber,
        queueId: parsed.data.queueId,
        recipients: parsed.data.recipients,
        nextIndex: 0,
        amdEnabled: parsed.data.amdEnabled ?? true,
        createdAt: now,
        updatedAt: now,
      });
      return created(campaign);
    }

    const campaignMatch = path.match(/^\/campaigns\/([^/]+)(?:\/(.*))?$/);
    if (campaignMatch) {
      const campaign = await getVoiceCampaign(auth.tenantId, campaignMatch[1]);
      if (!campaign) return notFound("Campaign not found");
      const action = campaignMatch[2] ?? "";
      if (!action && method === "GET") return ok(campaign);
      if (action === "attempts" && method === "GET") {
        return ok({ items: await listVoiceCampaignAttempts(auth.tenantId, campaign.campaignId) });
      }
      if (action === "start" && method === "POST") {
        if (!canStartCampaign(campaign)) return badRequest("Campaign cannot be started");
        const updated = await putVoiceCampaign({
          ...campaign,
          status: "running",
          startedAt: campaign.startedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await tryDialNextCampaignRecipient(auth.tenantId);
        return ok(updated);
      }
      if (action === "pause" && method === "POST") {
        const updated = await putVoiceCampaign({
          ...campaign,
          status: "paused",
          updatedAt: new Date().toISOString(),
        });
        return ok(updated);
      }
    }

    if (path === "/advisors" && method === "GET") {
      return ok({ items: await listAdvisors(auth.tenantId) });
    }

    return badRequest("Route not found");
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 403) return forbidden();
    return handleError(error);
  }
}
