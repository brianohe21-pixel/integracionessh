import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireEnabledCatalog } from "../../catalog/catalog.service.js";

export async function executeAwaitOrderNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  try {
    await requireEnabledCatalog(ctx.tenantId, ctx.botId);
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
      "El catálogo no está activo en este bot."
    );
    return { nextNodeId: null, halt: true, wait: false };
  }

  const prompt =
    node.data.messageText?.trim() ||
    "Agrega productos al carrito en WhatsApp y envía tu pedido cuando estés listo.";

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
    prompt
  );

  return {
    nextNodeId: null,
    halt: true,
    wait: true,
    externalWait: true,
    output: "awaiting_order",
  };
}
