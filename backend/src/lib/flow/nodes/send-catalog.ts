import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";
import { requireEnabledCatalog } from "../../catalog/catalog.service.js";
import { listProductsForBot } from "../../dynamodb/product.repository.js";
import { sendCatalogMessage } from "../../catalog/commerce-messages.js";
import { getBotLocale, getSystemMessage, resolveLocalizedText } from "../../i18n/index.js";

export async function executeSendCatalogNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const locale = getBotLocale(ctx.conversation, ctx.bot);
  const config = await requireEnabledCatalog(ctx.tenantId, ctx.botId);
  if (!config.metaCatalogId) {
    return {
      nextNodeId: null,
      halt: true,
      wait: false,
      output: "catalog_not_linked",
    };
  }

  const products = await listProductsForBot(ctx.tenantId, ctx.botId);
  const inStock = products.filter((p) => p.availability === "in_stock");
  const thumbnail = inStock[0] ?? products[0];
  if (!thumbnail) {
    return {
      nextNodeId: null,
      halt: true,
      wait: false,
      output: "no_products",
    };
  }

  const bodyText =
    resolveLocalizedText(node.data.catalogMessageText, locale) ||
    config.catalogMessageText ||
    getSystemMessage("catalogExploreDefault", locale);

  if (!ctx.accessToken) {
    return { nextNodeId: null, halt: true, wait: false };
  }

  await sendCatalogMessage({
    phoneNumberId: ctx.phoneNumberId,
    to: ctx.customerPhone,
    accessToken: ctx.accessToken,
    bodyText,
    catalogId: config.metaCatalogId,
    thumbnailProductRetailerId: thumbnail.retailerId,
  });

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    output: "catalog_sent",
  };
}
