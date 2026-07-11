import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";
import { createPaymentRequest } from "../../payments/payments.service.js";
import { formatPaymentMessage } from "../../payments/checkout.js";

export async function executeRequestPaymentNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const amountInCents = node.data.amountInCents;
  const description = node.data.paymentDescription?.trim() || node.data.label?.trim() || "Pago";

  if (!amountInCents || amountInCents < 1000) {
    await sendChannelText(
      buildOutboundContext({
        tenantId: ctx.tenantId,
        botId: ctx.botId,
        bot: ctx.bot,
        conversation: ctx.conversation,
        accessToken: ctx.accessToken,
        environment: ctx.environment,
      }),
      "El nodo de pago no tiene un monto válido configurado."
    );
    return { nextNodeId: null, halt: true, wait: false };
  }

  try {
    const waitForPayment = node.data.waitForPayment ?? false;
    const request = await createPaymentRequest({
      tenantId: ctx.tenantId,
      botId: ctx.botId,
      amountInCents,
      description,
      contactPhone: ctx.customerPhone,
      source: "flow",
      conversationId: ctx.conversation.conversationId,
      ...(waitForPayment ? { flowRunId: run.runId } : {}),
      environment: ctx.environment,
      sendWhatsApp: false,
    });

    const messageTemplate = node.data.paymentMessageTemplate;
    const text = formatPaymentMessage(
      messageTemplate,
      request.checkoutUrl,
      amountInCents,
      description
    );

    await sendChannelText(
      buildOutboundContext({
        tenantId: ctx.tenantId,
        botId: ctx.botId,
        bot: ctx.bot,
        conversation: ctx.conversation,
        accessToken: ctx.accessToken,
        environment: ctx.environment,
        replyToExternalId: ctx.replyToMessageId,
      }),
      text
    );

    const variables = {
      payment_id: request.paymentId,
      payment_url: request.checkoutUrl,
      payment_reference: request.reference,
    };

    if (waitForPayment) {
      return {
        nextNodeId: null,
        halt: true,
        wait: true,
        externalWait: true,
        variables,
      };
    }

    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id),
      halt: false,
      wait: false,
      variables,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo crear el cobro";
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
    return { nextNodeId: null, halt: true, wait: false };
  }
}
