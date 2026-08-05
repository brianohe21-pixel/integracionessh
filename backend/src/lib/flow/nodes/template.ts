import { sendTemplateMessage } from "../../whatsapp/client.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireMessagingContext } from "../types.js";
import { getNextNodeId } from "../graph.js";
import { skipWhatsAppOnlyNode } from "./channel-guard.js";
import { getBotLocale, templateLanguageForLocale } from "../../i18n/index.js";

export async function executeTemplateNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const skipped = skipWhatsAppOnlyNode(ctx, node.id, "template");
  if (skipped) return skipped;
  const { templateName, templateLanguage, templateVariables } = node.data;
  if (!templateName || !templateLanguage) {
    throw new Error("templateName and templateLanguage required");
  }
  const { conversation, phoneNumberId, accessToken, customerPhone } = requireMessagingContext(ctx);
  const locale = getBotLocale(conversation, ctx.bot);
  await sendTemplateMessage({
    phoneNumberId,
    to: customerPhone,
    templateName,
    language: templateLanguage || templateLanguageForLocale(locale),
    accessToken,
    ...(templateVariables
      ? {
          components: [
            {
              type: "body",
              parameters: Object.values(templateVariables).map((text) => ({
                type: "text" as const,
                text,
              })),
            },
          ],
        }
      : {}),
  });
  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    output: templateName,
  };
}
