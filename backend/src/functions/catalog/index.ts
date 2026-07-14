import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertCanEnableCatalog, assertCanAddProduct } from "../../lib/billing/assert-plan.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { getWhatsAppAccessToken } from "../../lib/whatsapp/client.js";
import {
  createProduct,
  disableCatalog,
  enableCatalog,
  finalizeProductImage,
  getConfigOrDefault,
  getOrderById,
  linkMetaCatalog,
  listMetaCatalogsForBot,
  listOrders,
  listProducts,
  prepareProductImageUpload,
  removeProduct,
  saveCatalogConfig,
  syncCatalogProducts,
  updateOrderStatus,
  updateProduct,
} from "../../lib/catalog/catalog.service.js";
import { ok, badRequest, created, handleError } from "../../lib/http.js";
import type { OrderStatus, ProductAvailability } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const ConfigSchema = z.object({
  autoCollectPayment: z.boolean().optional(),
  orderConfirmationMessage: z.string().max(500).optional(),
  orderStatusMessageTemplate: z.string().max(500).optional(),
  catalogMessageText: z.string().max(500).optional(),
});

const LinkCatalogSchema = z.object({
  metaCatalogId: z.string().min(1).max(64),
});

const ProductSchema = z.object({
  retailerId: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(""),
  priceInCents: z.number().int().min(100),
  availability: z.enum(["in_stock", "out_of_stock"]),
});

const ProductPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  priceInCents: z.number().int().min(100).optional(),
  availability: z.enum(["in_stock", "out_of_stock"]).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const ImageUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(100),
});

const FinalizeImageSchema = z.object({
  s3Key: z.string().min(1).max(500),
});

const PatchOrderSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
  internalNotes: z.string().max(500).optional(),
});

async function assertBotBelongsToTenant(tenantId: string, botId: string): Promise<void> {
  const bot = await getBot(tenantId, botId);
  if (!bot) throw new Error("Bot not found");
}

async function getAccessToken(tenantId: string): Promise<string | undefined> {
  return getWhatsAppAccessToken(tenantId, ENVIRONMENT);
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const botId = event.pathParameters?.botId;
    const productId = event.pathParameters?.productId;
    const orderId = event.pathParameters?.orderId;

    if (!botId) {
      return badRequest("botId is required");
    }

    await assertBotBelongsToTenant(auth.tenantId, botId);
    const bot = await getBot(auth.tenantId, botId);
    if (!bot) throw new Error("Bot not found");

    if (method === "GET" && rawPath === `/catalog/${botId}/config`) {
      const config = await getConfigOrDefault(auth.tenantId, botId);
      return ok({ config });
    }

    if (method === "PUT" && rawPath === `/catalog/${botId}/config`) {
      const body = ConfigSchema.parse(JSON.parse(event.body ?? "{}"));
      const config = await saveCatalogConfig(auth.tenantId, botId, {
        ...(body.autoCollectPayment !== undefined
          ? { autoCollectPayment: body.autoCollectPayment }
          : {}),
        ...(body.orderConfirmationMessage !== undefined
          ? { orderConfirmationMessage: body.orderConfirmationMessage }
          : {}),
        ...(body.orderStatusMessageTemplate !== undefined
          ? { orderStatusMessageTemplate: body.orderStatusMessageTemplate }
          : {}),
        ...(body.catalogMessageText !== undefined
          ? { catalogMessageText: body.catalogMessageText }
          : {}),
      });
      return ok({ config });
    }

    if (method === "POST" && rawPath === `/catalog/${botId}/enable`) {
      const tenant = await getTenant(auth.tenantId);
      if (!tenant) throw new Error("Tenant not found");
      await assertCanEnableCatalog(tenant, botId);
      const config = await enableCatalog(auth.tenantId, botId);
      return ok({ config });
    }

    if (method === "POST" && rawPath === `/catalog/${botId}/disable`) {
      const config = await disableCatalog(auth.tenantId, botId);
      return ok({ config });
    }

    if (method === "GET" && rawPath === `/catalog/${botId}/meta-catalogs`) {
      const accessToken = await getAccessToken(auth.tenantId);
      if (!accessToken) throw new Error("WhatsApp is not connected");
      const catalogs = await listMetaCatalogsForBot(
        bot.whatsappBusinessAccountId,
        accessToken
      );
      return ok({ catalogs });
    }

    if (method === "POST" && rawPath === `/catalog/${botId}/link-catalog`) {
      const body = LinkCatalogSchema.parse(JSON.parse(event.body ?? "{}"));
      const config = await linkMetaCatalog(auth.tenantId, botId, body.metaCatalogId);
      return ok({ config });
    }

    if (method === "POST" && rawPath === `/catalog/${botId}/sync`) {
      const accessToken = await getAccessToken(auth.tenantId);
      if (!accessToken) throw new Error("WhatsApp is not connected");
      const result = await syncCatalogProducts({
        tenantId: auth.tenantId,
        botId,
        accessToken,
      });
      return ok(result);
    }

    if (method === "GET" && rawPath === `/catalog/${botId}/products`) {
      const products = await listProducts(auth.tenantId, botId);
      return ok({ products });
    }

    if (method === "POST" && rawPath === `/catalog/${botId}/products`) {
      const tenant = await getTenant(auth.tenantId);
      if (!tenant) throw new Error("Tenant not found");
      await assertCanAddProduct(tenant, botId);
      const body = ProductSchema.parse(JSON.parse(event.body ?? "{}"));
      const accessToken = await getAccessToken(auth.tenantId);
      const product = await createProduct({
        tenantId: auth.tenantId,
        botId,
        retailerId: body.retailerId,
        name: body.name,
        description: body.description,
        priceInCents: body.priceInCents,
        availability: body.availability as ProductAvailability,
        ...(accessToken ? { accessToken } : {}),
      });
      return created({ product });
    }

    if (productId && method === "GET" && rawPath === `/catalog/${botId}/products/${productId}`) {
      const products = await listProducts(auth.tenantId, botId);
      const product = products.find((p) => p.productId === productId);
      if (!product) throw new Error("Product not found");
      return ok({ product });
    }

    if (productId && method === "PUT" && rawPath === `/catalog/${botId}/products/${productId}`) {
      const body = ProductPatchSchema.parse(JSON.parse(event.body ?? "{}"));
      const accessToken = await getAccessToken(auth.tenantId);
      const product = await updateProduct({
        tenantId: auth.tenantId,
        botId,
        productId,
        patch: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.priceInCents !== undefined ? { priceInCents: body.priceInCents } : {}),
          ...(body.availability !== undefined ? { availability: body.availability } : {}),
          ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        },
        ...(accessToken ? { accessToken } : {}),
      });
      return ok({ product });
    }

    if (productId && method === "DELETE" && rawPath === `/catalog/${botId}/products/${productId}`) {
      const accessToken = await getAccessToken(auth.tenantId);
      await removeProduct({
        tenantId: auth.tenantId,
        botId,
        productId,
        ...(accessToken ? { accessToken } : {}),
      });
      return ok({ deleted: true });
    }

    if (
      productId &&
      method === "POST" &&
      rawPath === `/catalog/${botId}/products/${productId}/image`
    ) {
      const body = ImageUploadSchema.parse(JSON.parse(event.body ?? "{}"));
      const result = await prepareProductImageUpload({
        tenantId: auth.tenantId,
        botId,
        productId,
        filename: body.filename,
        contentType: body.contentType,
      });
      return ok(result);
    }

    if (
      productId &&
      method === "POST" &&
      rawPath === `/catalog/${botId}/products/${productId}/image/finalize`
    ) {
      const body = FinalizeImageSchema.parse(JSON.parse(event.body ?? "{}"));
      const accessToken = await getAccessToken(auth.tenantId);
      const product = await finalizeProductImage({
        tenantId: auth.tenantId,
        botId,
        productId,
        s3Key: body.s3Key,
        ...(accessToken ? { accessToken } : {}),
      });
      return ok({ product });
    }

    if (method === "GET" && rawPath === `/catalog/${botId}/orders`) {
      const status = event.queryStringParameters?.status as OrderStatus | undefined;
      const from = event.queryStringParameters?.from;
      const to = event.queryStringParameters?.to;
      const orders = await listOrders({
        tenantId: auth.tenantId,
        botId,
        ...(status ? { status } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      return ok({ orders });
    }

    if (orderId && method === "GET" && rawPath === `/catalog/${botId}/orders/${orderId}`) {
      const order = await getOrderById(auth.tenantId, botId, orderId);
      if (!order) throw new Error("Order not found");
      return ok({ order });
    }

    if (orderId && method === "PATCH" && rawPath === `/catalog/${botId}/orders/${orderId}`) {
      const body = PatchOrderSchema.parse(JSON.parse(event.body ?? "{}"));
      const order = await updateOrderStatus({
        tenantId: auth.tenantId,
        botId,
        orderId,
        status: body.status,
        ...(body.internalNotes !== undefined ? { internalNotes: body.internalNotes } : {}),
        environment: ENVIRONMENT,
      });
      return ok({ order });
    }

    return badRequest("Not found");
  } catch (err) {
    return handleError(err);
  }
}
