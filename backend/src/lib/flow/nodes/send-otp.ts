import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireBotContext, requireConversation } from "../types.js";
import { getBotLocale, getSystemMessage, resolveLocalizedText } from "../../i18n/index.js";
import { sendOtp, verifyOtp } from "../../otp/service.js";
import { getNextNodeId } from "../graph.js";
import { getWhatsAppAccessToken } from "../../whatsapp/client.js";

const DEFAULT_OTP_MESSAGE =
  "Tu codigo de verificacion es {{code}}. Expira en 5 minutos.";

function resolveOtpChannel(ctx: FlowExecutionContext): "sms" | "whatsapp" | null {
  if (ctx.channel === "sms" || ctx.channel === "whatsapp") return ctx.channel;
  return null;
}

export async function executeSendOtpNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const channel = resolveOtpChannel(ctx);
  if (!channel) {
    console.warn(`Skipping send_otp node on channel ${ctx.channel}`);
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id, "failed"),
      halt: false,
      wait: false,
      output: "unsupported_channel",
    };
  }

  const conversation = requireConversation(ctx);
  const { botId, bot } = requireBotContext(ctx);
  const destination = conversation.phoneNumber.replace(/\D/g, "");
  if (!destination) {
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id, "failed"),
      halt: false,
      wait: false,
      output: "missing_destination",
    };
  }

  const locale = getBotLocale(conversation, bot);
  const inboundCode = ctx.inbound?.text?.replace(/\D/g, "") ?? "";

  if (run.variables.otp_sent === "true" && inboundCode) {
    const result = await verifyOtp({
      tenantId: ctx.tenantId,
      to: destination,
      code: inboundCode,
    });

    if (result.verified) {
      return {
        nextNodeId: getNextNodeId(ctx.flow, node.id, "verified"),
        halt: false,
        wait: false,
        output: "verified",
      };
    }

    if (result.reason === "invalid_code") {
      return {
        nextNodeId: null,
        halt: true,
        wait: true,
        externalWait: true,
        output: "invalid_code",
        variables: {
          otp_attempts_remaining: String(result.attemptsRemaining ?? 0),
        },
      };
    }

    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id, "failed"),
      halt: false,
      wait: false,
      output: result.reason,
    };
  }

  const messageTemplate =
    resolveLocalizedText(node.data.otpMessageText, locale) ||
    getSystemMessage("otpPrompt", locale) ||
    DEFAULT_OTP_MESSAGE;

  const accessToken =
    channel === "whatsapp"
      ? ctx.accessToken ?? (await getWhatsAppAccessToken(ctx.tenantId, ctx.environment))
      : undefined;

  await sendOtp({
    tenantId: ctx.tenantId,
    botId,
    channel,
    to: destination,
    messageTemplate,
    ...(node.data.otpWhatsAppTemplateName && node.data.otpWhatsAppTemplateLanguage
      ? {
          whatsappTemplate: {
            name: node.data.otpWhatsAppTemplateName,
            language: node.data.otpWhatsAppTemplateLanguage,
          },
        }
      : {}),
    ...(node.data.otpMaxAttempts ? { maxAttempts: node.data.otpMaxAttempts } : {}),
    ...(accessToken ? { accessToken } : {}),
    environment: ctx.environment,
  });

  return {
    nextNodeId: null,
    halt: true,
    wait: true,
    externalWait: true,
    output: "awaiting_otp",
    variables: {
      otp_sent: "true",
      otp_destination: destination,
    },
  };
}
