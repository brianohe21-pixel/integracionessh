import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import { sendInteractiveButtons } from "../../whatsapp/flows.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";
import {
  createBookingForBot,
  formatBookingConfirmation,
  getBookingDates,
  getBookingSlotsForDate,
  requireEnabledCalendar,
} from "../../calendar/calendar.service.js";
import {
  getBotLocale,
  getSystemMessage,
  intlLocaleForBot,
  resolveLocalizedText,
} from "../../i18n/index.js";

const CONFIRM_YES = "booking_confirm_yes";
const CONFIRM_NO = "booking_confirm_no";

function nodeStateKey(nodeId: string): string {
  return `booking_${nodeId}_step`;
}

function nodeDateKey(nodeId: string): string {
  return `booking_${nodeId}_date`;
}

function nodeSlotKey(nodeId: string): string {
  return `booking_${nodeId}_slot`;
}

function parseSelection(input: string | undefined): string | null {
  if (!input?.trim()) return null;
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  return trimmed;
}

function buildNumberedOptions(
  options: Array<{ id: string; label: string }>
): { text: string; map: Map<string, string> } {
  const map = new Map<string, string>();
  const lines = options.map((opt, index) => {
    const num = String(index + 1);
    map.set(num, opt.id);
    return `${num}. ${opt.label}`;
  });
  return { text: lines.join("\n"), map };
}

async function sendOptions(
  ctx: FlowExecutionContext,
  bodyText: string,
  options: Array<{ id: string; label: string }>
): Promise<void> {
  const outbound = buildOutboundContext({
    tenantId: ctx.tenantId,
    botId: ctx.botId,
    bot: ctx.bot,
    conversation: ctx.conversation,
    accessToken: ctx.accessToken,
    environment: ctx.environment,
    replyToExternalId: ctx.replyToMessageId,
  });

  if (ctx.channel === "whatsapp" && options.length <= 3) {
    await sendInteractiveButtons({
      phoneNumberId: ctx.phoneNumberId,
      to: ctx.customerPhone,
      accessToken: ctx.accessToken,
      bodyText,
      buttons: options.map((o) => ({ id: o.id, title: o.label.slice(0, 20) })),
      ...(ctx.replyToMessageId ? { replyToMessageId: ctx.replyToMessageId } : {}),
    });
    return;
  }

  const numbered = buildNumberedOptions(options);
  await sendChannelText(outbound, `${bodyText}\n\n${numbered.text}`);
}

export async function executeBookAppointmentNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const locale = getBotLocale(ctx.conversation, ctx.bot);
  let config;
  try {
    config = await requireEnabledCalendar(ctx.tenantId, ctx.botId);
  } catch {
    await sendChannelText(
      buildOutboundContext({
        tenantId: ctx.tenantId,
        botId: ctx.botId,
        bot: ctx.bot,
        conversation: ctx.conversation,
        accessToken: ctx.accessToken,
        environment: ctx.environment,
      }),
      getSystemMessage("calendarUnavailable", locale)
    );
    return { nextNodeId: null, halt: true, wait: false };
  }

  const stepKey = nodeStateKey(node.id);
  const dateKey = nodeDateKey(node.id);
  const slotKey = nodeSlotKey(node.id);
  const maxDays = node.data.maxDaysToShow ?? 7;
  const selection =
    ctx.buttonReplyId ?? parseSelection(run.variables.last_input) ?? parseSelection(ctx.inbound.text);

  let step = run.variables[stepKey] ?? "pick_date";

  if (step === "pick_date" && selection?.startsWith("date-")) {
    step = "pick_slot";
  } else if (step === "pick_slot" && selection?.startsWith("slot-")) {
    step = "confirm";
  } else if (step === "confirm") {
    if (selection === CONFIRM_YES || selection === "1") {
      const startAt = run.variables[slotKey];
      if (!startAt) {
        return { nextNodeId: null, halt: true, wait: false };
      }
      try {
        const result = await createBookingForBot({
          tenantId: ctx.tenantId,
          botId: ctx.botId,
          startAt,
          contactPhone: ctx.customerPhone,
          conversationId: ctx.conversation.conversationId,
          source: "flow",
          environment: ctx.environment,
        });
        const booking = result.booking;
        const scheduledPrefix =
          locale === "en"
            ? getSystemMessage("bookingScheduledPrefixEn", locale)
            : getSystemMessage("bookingScheduledPrefix", locale);
        const confirmationBase =
          resolveLocalizedText(node.data.confirmationMessage, locale) ||
          `${scheduledPrefix} ${formatBookingConfirmation(booking, config)}.`;
        const confirmation = result.payment
          ? `${confirmationBase} ${getSystemMessage("bookingPaymentLink", locale)}`
          : confirmationBase;
        await sendChannelText(
          buildOutboundContext({
            tenantId: ctx.tenantId,
            botId: ctx.botId,
            bot: ctx.bot,
            conversation: ctx.conversation,
            accessToken: ctx.accessToken,
            environment: ctx.environment,
          }),
          confirmation
        );
        return {
          nextNodeId: getNextNodeId(ctx.flow, node.id),
          halt: false,
          wait: false,
          variables: {
            [stepKey]: "",
            [dateKey]: "",
            [slotKey]: "",
            booking_id: booking.bookingId,
            booking_start: booking.startAt,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo agendar la cita";
        await sendChannelText(
          buildOutboundContext({
            tenantId: ctx.tenantId,
            botId: ctx.botId,
            bot: ctx.bot,
            conversation: ctx.conversation,
            accessToken: ctx.accessToken,
            environment: ctx.environment,
          }),
          message
        );
        return {
          nextNodeId: null,
          halt: true,
          wait: true,
          variables: { [stepKey]: "pick_date", [dateKey]: "", [slotKey]: "" },
        };
      }
    }
    if (selection === CONFIRM_NO || selection === "2") {
      await sendChannelText(
        buildOutboundContext({
          tenantId: ctx.tenantId,
          botId: ctx.botId,
          bot: ctx.bot,
          conversation: ctx.conversation,
          accessToken: ctx.accessToken,
          environment: ctx.environment,
        }),
        getSystemMessage("bookingCancelled", locale)
      );
      return {
        nextNodeId: null,
        halt: true,
        wait: true,
        variables: { [stepKey]: "pick_date", [dateKey]: "", [slotKey]: "" },
      };
    }
  }

  if (step === "pick_date") {
    const dates = await getBookingDates({
      tenantId: ctx.tenantId,
      botId: ctx.botId,
      maxDays,
    });
    if (dates.length === 0) {
      await sendChannelText(
        buildOutboundContext({
          tenantId: ctx.tenantId,
          botId: ctx.botId,
          bot: ctx.bot,
          conversation: ctx.conversation,
          accessToken: ctx.accessToken,
          environment: ctx.environment,
        }),
        getSystemMessage("bookingNoDates", locale)
      );
      return { nextNodeId: null, halt: true, wait: false };
    }
    const options = dates.map((d) => ({
      id: `date-${d.isoDate}`,
      label: d.label,
    }));
    if (selection) {
      const resolved =
        selection.startsWith("date-") ? selection : options[Number(selection) - 1]?.id;
      if (resolved?.startsWith("date-")) {
        return executeBookAppointmentNode(
          node,
          {
            ...ctx,
            buttonReplyId: resolved,
          },
          {
            ...run,
            variables: {
              ...run.variables,
              [stepKey]: "pick_slot",
              [dateKey]: resolved.replace("date-", ""),
            },
          }
        );
      }
    }
    await sendOptions(ctx, getSystemMessage("bookingPickDate", locale), options);
    return {
      nextNodeId: null,
      halt: true,
      wait: true,
      variables: { [stepKey]: "pick_date" },
    };
  }

  if (step === "pick_slot") {
    const isoDate = run.variables[dateKey];
    if (!isoDate) {
      return executeBookAppointmentNode(node, ctx, {
        ...run,
        variables: { ...run.variables, [stepKey]: "pick_date" },
      });
    }
    const slots = await getBookingSlotsForDate({
      tenantId: ctx.tenantId,
      botId: ctx.botId,
      isoDate,
    });
    if (slots.length === 0) {
      await sendChannelText(
        buildOutboundContext({
          tenantId: ctx.tenantId,
          botId: ctx.botId,
          bot: ctx.bot,
          conversation: ctx.conversation,
          accessToken: ctx.accessToken,
          environment: ctx.environment,
        }),
        getSystemMessage("bookingNoSlots", locale)
      );
      return {
        nextNodeId: null,
        halt: true,
        wait: true,
        variables: { [stepKey]: "pick_date", [dateKey]: "" },
      };
    }
    const options = slots.map((s) => ({
      id: `slot-${s.startAt}`,
      label: s.label,
    }));
    if (selection) {
      const resolved =
        selection.startsWith("slot-") ? selection : options[Number(selection) - 1]?.id;
      if (resolved?.startsWith("slot-")) {
        const startAt = resolved.replace("slot-", "");
        return executeBookAppointmentNode(
          node,
          ctx,
          {
            ...run,
            variables: {
              ...run.variables,
              [stepKey]: "confirm",
              [slotKey]: startAt,
            },
          }
        );
      }
    }
    await sendOptions(ctx, getSystemMessage("bookingPickSlot", locale), options);
    return {
      nextNodeId: null,
      halt: true,
      wait: true,
      variables: { ...run.variables, [stepKey]: "pick_slot", [dateKey]: isoDate },
    };
  }

  const startAt = run.variables[slotKey];
  const dateLabel = run.variables[dateKey] ?? "";
  const confirmText = locale === "en"
    ? `Confirm appointment on ${dateLabel} at ${startAt ? new Date(startAt).toLocaleTimeString(intlLocaleForBot(locale), { hour: "2-digit", minute: "2-digit", timeZone: config.timezone }) : ""}?`
    : `Confirmar cita el ${dateLabel} a las ${startAt ? new Date(startAt).toLocaleTimeString(intlLocaleForBot(locale), { hour: "2-digit", minute: "2-digit", timeZone: config.timezone }) : ""}?`;
  if (ctx.channel === "whatsapp") {
    await sendInteractiveButtons({
      phoneNumberId: ctx.phoneNumberId,
      to: ctx.customerPhone,
      accessToken: ctx.accessToken,
      bodyText: confirmText,
      buttons: [
        { id: CONFIRM_YES, title: getSystemMessage("bookingConfirmYes", locale) },
        { id: CONFIRM_NO, title: getSystemMessage("bookingConfirmNo", locale) },
      ],
      ...(ctx.replyToMessageId ? { replyToMessageId: ctx.replyToMessageId } : {}),
    });
  } else {
    await sendOptions(ctx, confirmText, [
      { id: CONFIRM_YES, label: getSystemMessage("bookingConfirmYes", locale) },
      { id: CONFIRM_NO, label: getSystemMessage("bookingConfirmNo", locale) },
    ]);
  }
  return {
    nextNodeId: null,
    halt: true,
    wait: true,
    variables: { ...run.variables, [stepKey]: "confirm" },
  };
}
