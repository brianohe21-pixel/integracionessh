import { sendTemplateMessage } from "../../whatsapp/client.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
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
  const locale = getBotLocale(ctx.conversation, ctx.bot);
  await sendTemplateMessage({
    phoneNumberId: ctx.phoneNumberId,
    to: ctx.customerPhone,
    templateName,
    language: templateLanguage || templateLanguageForLocale(locale),
    accessToken: ctx.accessToken,
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
