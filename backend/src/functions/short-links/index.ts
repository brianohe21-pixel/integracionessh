import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { createHash } from "crypto";
import { z } from "zod";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import {
  createShortLink,
  deleteShortLink,
  getShortLink,
  getShortLinkBySlug,
  listShortLinkClicks,
  listShortLinks,
  makeShortLinkId,
  recordShortLinkClick,
  updateShortLink,
} from "../../lib/dynamodb/short-link.repository.js";
import { badRequest, created, handleError, noContent, notFound, ok, redirect } from "../../lib/http.js";
import { checkAndIncrement } from "../../lib/rate-limiter/index.js";
import { buildRedirectUrl } from "../../lib/short-links/redirect.js";
import {
  buildShortLinkUrl,
  generateShortLinkSlug,
  SLUG_PATTERN,
} from "../../lib/short-links/slug.js";
import type { ShortLink, ShortLinkUtm } from "../../types/index.js";

const RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_PER_DAY = 5000;

const UtmSchema = z.object({
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(128).optional(),
  utmContent: z.string().max(128).optional(),
  utmTerm: z.string().max(128).optional(),
});

const CreateShortLinkSchema = z.object({
  name: z.string().min(1).max(120),
  destinationUrl: z.string().url().max(2000),
  slug: z.string().regex(SLUG_PATTERN).optional(),
  enabled: z.boolean().optional(),
  campaignId: z.string().uuid().optional(),
  utm: UtmSchema.optional(),
  expiresAt: z.string().datetime().optional(),
});

const UpdateShortLinkSchema = CreateShortLinkSchema.partial();

function withPublicMeta(link: ShortLink) {
  return {
    ...link,
    shortUrl: buildShortLinkUrl(link.slug),
  };
}

function normalizeUtm(utm?: ShortLinkUtm): ShortLinkUtm {
  if (!utm) return {};
  const result: ShortLinkUtm = {};
  if (utm.utmSource) result.utmSource = utm.utmSource;
  if (utm.utmMedium) result.utmMedium = utm.utmMedium;
  if (utm.utmCampaign) result.utmCampaign = utm.utmCampaign;
  if (utm.utmContent) result.utmContent = utm.utmContent;
  if (utm.utmTerm) result.utmTerm = utm.utmTerm;
  return result;
}

async function resolveUniqueSlug(requested?: string): Promise<string> {
  if (requested) {
    const taken = await getShortLinkBySlug(requested);
    if (taken) {
      const error = new Error("Slug already in use") as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }
    return requested;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = generateShortLinkSlug();
    const taken = await getShortLinkBySlug(slug);
    if (!taken) return slug;
  }

  const error = new Error("Could not generate unique slug") as Error & { statusCode?: number };
  error.statusCode = 500;
  throw error;
}

async function handleRedirect(
  event: APIGatewayProxyEventV2,
  slug: string
): Promise<APIGatewayProxyResultV2> {
  const lookup = await getShortLinkBySlug(slug);
  if (!lookup) return notFound("Link not found");

  const link = await getShortLink(lookup.tenantId, lookup.linkId);
  if (!link || !link.enabled || link.slug.toLowerCase() !== slug.toLowerCase()) {
    return notFound("Link not found");
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
    return notFound("Link expired");
  }

  const rateKey = createHash("sha256").update(`short-link:${slug}`).digest("hex");
  const rate = await checkAndIncrement(rateKey, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_PER_DAY);
  if (!rate.allowed) {
    return {
      statusCode: 429,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        ...(rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : {}),
      },
      body: JSON.stringify({ error: "Rate limit exceeded" }),
    };
  }

  const query = event.queryStringParameters ?? {};
  const clickQuery: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) clickQuery[key] = value;
  }

  const clickMeta: {
    link: ShortLink;
    userAgent?: string;
    referer?: string;
    ip?: string;
  } = { link };

  const userAgent = event.headers["user-agent"] ?? event.headers["User-Agent"];
  const referer = event.headers.referer ?? event.headers.Referer;
  if (userAgent) clickMeta.userAgent = userAgent;
  if (referer) clickMeta.referer = referer;
  if (event.requestContext.http.sourceIp) clickMeta.ip = event.requestContext.http.sourceIp;

  await recordShortLinkClick(clickMeta).catch((err) =>
    console.error("Failed to record short link click:", err)
  );

  const destination = buildRedirectUrl(link.destinationUrl, link.utm ?? {}, clickQuery);
  return redirect(destination);
}

function parseShortLinksPath(rawPath: string): string[] {
  const normalized = rawPath.replace(/\/+$/, "");
  if (!normalized.startsWith("/short-links/")) return [];
  return normalized.slice("/short-links/".length).split("/").filter(Boolean);
}

async function handleCreateShortLink(
  event: APIGatewayProxyEventV2,
  tenantId: string
): Promise<APIGatewayProxyResultV2> {
  const body = JSON.parse(event.body ?? "{}");
  const parsed = CreateShortLinkSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  const now = new Date().toISOString();
  const slug = await resolveUniqueSlug(parsed.data.slug);
  const link: ShortLink = {
    linkId: makeShortLinkId(),
    tenantId,
    name: parsed.data.name,
    slug,
    destinationUrl: parsed.data.destinationUrl,
    enabled: parsed.data.enabled ?? true,
    utm: normalizeUtm(parsed.data.utm as ShortLinkUtm | undefined),
    clickCount: 0,
    createdAt: now,
    updatedAt: now,
    ...(parsed.data.campaignId ? { campaignId: parsed.data.campaignId } : {}),
    ...(parsed.data.expiresAt ? { expiresAt: parsed.data.expiresAt } : {}),
  };

  await createShortLink(link);
  return created(withPublicMeta(link));
}

async function handleProtected(
  event: APIGatewayProxyEventV2,
  method: string,
  tenantId: string
): Promise<APIGatewayProxyResultV2> {
  const rawPath = event.rawPath ?? event.requestContext.http.path;
  const segments = parseShortLinksPath(rawPath);

  if (method === "GET" && segments.length === 1 && segments[0] === "list") {
    const links = await listShortLinks(tenantId);
    return ok({ items: links.map(withPublicMeta) });
  }

  if (method === "POST" && segments.length === 1 && segments[0] === "create") {
    return handleCreateShortLink(event, tenantId);
  }

  const linkId = segments[0];
  if (!linkId || linkId === "list" || linkId === "create") {
    return badRequest("Invalid short link path");
  }

  const isClicksRoute = segments.length === 2 && segments[1] === "clicks";

  if (method === "GET" && isClicksRoute) {
    const link = await getShortLink(tenantId, linkId);
    if (!link) return notFound("Link not found");
    const clicks = await listShortLinkClicks(tenantId, linkId);
    return ok({ items: clicks });
  }

  if (method === "GET" && segments.length === 1) {
    const link = await getShortLink(tenantId, linkId);
    if (!link) return notFound("Link not found");
    return ok(withPublicMeta(link));
  }

  if (method === "PATCH" && segments.length === 1) {
    const body = JSON.parse(event.body ?? "{}");
    const parsed = UpdateShortLinkSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.message);

    const existing = await getShortLink(tenantId, linkId);
    if (!existing) return notFound("Link not found");

    if (parsed.data.slug && parsed.data.slug.toLowerCase() !== existing.slug.toLowerCase()) {
      const taken = await getShortLinkBySlug(parsed.data.slug);
      if (taken && taken.linkId !== linkId) {
        const error = new Error("Slug already in use") as Error & { statusCode?: number };
        error.statusCode = 409;
        throw error;
      }
    }

    const updated = await updateShortLink(tenantId, linkId, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.destinationUrl !== undefined
        ? { destinationUrl: parsed.data.destinationUrl }
        : {}),
      ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.campaignId !== undefined ? { campaignId: parsed.data.campaignId } : {}),
      ...(parsed.data.expiresAt !== undefined ? { expiresAt: parsed.data.expiresAt } : {}),
      ...(parsed.data.utm !== undefined
        ? { utm: normalizeUtm(parsed.data.utm as ShortLinkUtm) }
        : {}),
    });
    if (!updated) return notFound("Link not found");
    return ok(withPublicMeta(updated));
  }

  if (method === "DELETE" && segments.length === 1) {
    const deleted = await deleteShortLink(tenantId, linkId);
    if (!deleted) return notFound("Link not found");
    return noContent();
  }

  return badRequest("Method not allowed");
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    if (method === "OPTIONS") {
      return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*" } };
    }

    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const redirectMatch = rawPath.match(/^\/l\/([^/]+)$/);
    if (redirectMatch && method === "GET") {
      return handleRedirect(event, decodeURIComponent(redirectMatch[1]!));
    }

    const auth = await resolveRequestAuth(event as APIGatewayProxyEventV2WithJWTAuthorizer);
    assertMemberRole(auth);

    if (rawPath.startsWith("/short-links/")) {
      return handleProtected(event, method, auth.tenantId);
    }

    return notFound();
  } catch (error) {
    return handleError(error);
  }
}
