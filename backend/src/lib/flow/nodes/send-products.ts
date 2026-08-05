import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireMessagingContext } from "../types.js";
import { getNextNodeId } from "../graph.js";
import { requireEnabledCatalog } from "../../catalog/catalog.service.js";
import { listProductsForBot } from "../../dynamodb/product.repository.js";
import {
  sendMultiProductMessage,
  sendSingleProductMessage,
} from "../../catalog/commerce-messages.js";
import { getBotLocale, getSystemMessage, resolveLocalizedText } from "../../i18n/index.js";

export async function executeSendProductsNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const { conversation, phoneNumberId, accessToken, customerPhone } = requireMessagingContext(ctx);
  const locale = getBotLocale(conversation, ctx.bot);
  const config = await requireEnabledCatalog(ctx.tenantId, ctx.botId);
  if (!config.metaCatalogId) {
    return { nextNodeId: null, halt: true, wait: false, output: "catalog_not_linked" };
  }

  if (!accessToken) {
    return { nextNodeId: null, halt: true, wait: false };
  }

  const requestedIds = node.data.productRetailerIds ?? [];
  const products = await listProductsForBot(ctx.tenantId, ctx.botId);
  const retailerIds =
    requestedIds.length > 0
      ? requestedIds
      : products.filter((p) => p.availability === "in_stock").map((p) => p.retailerId);

  if (retailerIds.length === 0) {
    return { nextNodeId: null, halt: true, wait: false, output: "no_products" };
  }

  const bodyText =
    resolveLocalizedText(node.data.messageText, locale) ||
    getSystemMessage("catalogDefault", locale);

  if (retailerIds.length === 1) {
    await sendSingleProductMessage({
      phoneNumberId,
      to: customerPhone,
      accessToken,
      bodyText,
      catalogId: config.metaCatalogId,
      productRetailerId: retailerIds[0]!,
    });
  } else {
    await sendMultiProductMessage({
      phoneNumberId,
      to: customerPhone,
      accessToken,
      headerText:
        resolveLocalizedText(node.data.multiProductHeader, locale) ||
        getSystemMessage("productsHeader", locale),
      bodyText:
        resolveLocalizedText(node.data.multiProductBody, locale) || bodyText,
      catalogId: config.metaCatalogId,
      sectionTitle:
        node.data.label?.trim() || getSystemMessage("catalogSection", locale),
      productRetailerIds: retailerIds.slice(0, 30),
    });
  }

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    output: "products_sent",
  };
}
