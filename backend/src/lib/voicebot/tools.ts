import type { BotLocale } from "../../types/index.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import {
  createBookingForBot,
  formatBookingConfirmation,
  getBookingSlotsForDate,
  updateBookingStatus,
} from "../calendar/calendar.service.js";
import { retrieveContext } from "../knowledge/retrieve.js";
import { performHandoff } from "../advisor/handoff.js";
import { getSystemMessage } from "../i18n/index.js";

import { executeVoiceFlowTool } from "./voice-flow-tools.js";
import { executeVoiceAgentHttpTool } from "./voice-agent-tool-executor.js";

export interface VoicebotToolContext {
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  locale: BotLocale;
  knowledgeEnabled: boolean;
  handoffEnabled: boolean;
  apiKey: string;
  environment: string;
}

export async function executeVoicebotTool(
  name: string,
  argsJson: string,
  ctx: VoicebotToolContext
): Promise<{ output: string; handoff?: boolean }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson) as Record<string, unknown>;
  } catch {
    return { output: JSON.stringify({ error: "Invalid tool arguments" }) };
  }

  const agentResult = await executeVoiceAgentHttpTool({
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    toolName: name,
    args,
    environment: ctx.environment,
  });
  if (agentResult) {
    return { output: agentResult.output };
  }

  const flowResult = await executeVoiceFlowTool({
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    locale: ctx.locale,
    toolName: name,
    args,
    environment: ctx.environment,
  });
  if (flowResult) {
    return { output: flowResult.output };
  }

  if (name === "transfer_to_human") {
    if (!ctx.handoffEnabled) {
      return { output: JSON.stringify({ error: "Human handoff is disabled for this agent" }) };
    }
    const reason =
      typeof args.reason === "string" && args.reason.trim()
        ? args.reason.trim()
        : getSystemMessage("handoffRequestedReason", ctx.locale);
    await performHandoff({
      tenantId: ctx.tenantId,
      botId: ctx.botId,
      conversationId: ctx.conversationId,
      reason: "ai",
    });
    return {
      output: JSON.stringify({ success: true, message: reason }),
      handoff: true,
    };
  }

  if (name === "search_knowledge") {
    if (!ctx.knowledgeEnabled) {
      return { output: JSON.stringify({ error: "Knowledge base is not enabled" }) };
    }
    const query = typeof args.query === "string" ? args.query.trim() : "";
    if (!query) {
      return { output: JSON.stringify({ error: "query is required" }) };
    }
    const context = await retrieveContext(ctx.tenantId, ctx.botId, query, ctx.apiKey);
    return {
      output: JSON.stringify({
        query,
        context: context || (ctx.locale === "en" ? "No relevant information found." : "No se encontró información relevante."),
      }),
    };
  }

  const calendarConfig = await getCalendarConfig(ctx.tenantId, ctx.botId);
  if (!calendarConfig?.enabled) {
    return { output: JSON.stringify({ error: "Calendar is not enabled" }) };
  }

  if (name === "list_available_slots") {
    const date = typeof args.date === "string" ? args.date : "";
    if (!date) {
      return { output: JSON.stringify({ error: "date is required in YYYY-MM-DD format" }) };
    }
    const slots = await getBookingSlotsForDate({
      tenantId: ctx.tenantId,
      botId: ctx.botId,
      isoDate: date,
    });
    return {
      output: JSON.stringify({
        date,
        timezone: calendarConfig.timezone,
        slots: slots.map((slot) => ({ label: slot.label, startAt: slot.startAt })),
        count: slots.length,
      }),
    };
  }

  if (name === "create_booking") {
    const startAt = typeof args.startAt === "string" ? args.startAt : "";
    if (!startAt) {
      return { output: JSON.stringify({ error: "startAt is required" }) };
    }
    const contactName = typeof args.contactName === "string" ? args.contactName : undefined;
    const result = await createBookingForBot({
      tenantId: ctx.tenantId,
      botId: ctx.botId,
      startAt,
      contactPhone: ctx.participantId,
      conversationId: ctx.conversationId,
      ...(contactName ? { contactName } : {}),
      source: "openai",
    });
    const label = formatBookingConfirmation(result.booking, calendarConfig);
    return {
      output: JSON.stringify({
        success: true,
        bookingId: result.booking.bookingId,
        label,
        paymentRequired: Boolean(result.payment),
      }),
    };
  }

  if (name === "cancel_booking") {
    const bookingId = typeof args.bookingId === "string" ? args.bookingId : "";
    if (!bookingId) {
      return { output: JSON.stringify({ error: "bookingId is required" }) };
    }
    await updateBookingStatus({
      tenantId: ctx.tenantId,
      botId: ctx.botId,
      bookingId,
      status: "cancelled",
    });
    return { output: JSON.stringify({ success: true, bookingId }) };
  }

  return { output: JSON.stringify({ error: `Unknown tool: ${name}` }) };
}
