import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import {
  createContact,
  getContactByPhone,
  listContacts,
  listContactsForExport,
  importContactsBatch,
  updateContact,
  suppressContact,
  normalizePhone,
  countContacts,
} from "../../lib/dynamodb/contact.repository.js";
import { writeComplianceLog } from "../../lib/compliance/audit-log.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanAddContacts } from "../../lib/billing/assert-plan.js";
import { PlanLimitError } from "../../lib/billing/plan-limits.js";
import {
  extractAuthContext,
  assertMemberRole,
} from "../../lib/auth/cognito.js";
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  handleError,
} from "../../lib/http.js";
import type { Contact, MarketingConsent } from "../../types/index.js";

const CreateContactSchema = z.object({
  phoneNumber: z.string().min(10).max(20),
  displayName: z.string().max(128).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  marketingConsent: z.enum(["unknown", "opt_in", "opt_out"]).optional(),
});

const UpdateContactSchema = z.object({
  displayName: z.string().max(128).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  marketingConsent: z.enum(["unknown", "opt_in", "opt_out"]).optional(),
  suppressed: z.boolean().optional(),
});

const ImportSchema = z.object({
  rows: z
    .array(
      z.object({
        phone: z.string().min(10),
        name: z.string().max(128).optional(),
        tags: z.array(z.string().max(50)).optional(),
        marketingConsent: z.enum(["unknown", "opt_in", "opt_out"]).optional(),
      })
    )
    .min(1)
    .max(5000),
});

function parseSubPath(rawPath: string, phone: string): string | null {
  const encoded = encodeURIComponent(phone);
  const suffix =
    rawPath.split(`/contacts/${encoded}`)[1] ??
    rawPath.split(`/contacts/${phone}`)[1] ??
    "";
  if (!suffix || suffix === "") return null;
  return suffix.replace(/^\//, "").split("/")[0] ?? null;
}

function exportCsv(contacts: Contact[]): string {
  const header = "phone,displayName,marketingConsent,suppressed,tags";
  const rows = contacts.map((c) => {
    const tags = c.tags.join("|");
    const name = (c.displayName ?? "").replace(/"/g, '""');
    return `${c.phoneNumber},"${name}",${c.marketingConsent},${c.suppressed},"${tags}"`;
  });
  return [header, ...rows].join("\n");
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const phoneParam = event.pathParameters?.phone
      ? decodeURIComponent(event.pathParameters.phone)
      : undefined;
    const params = event.queryStringParameters ?? {};

    if (method === "GET" && rawPath.endsWith("/contacts/export")) {
      const type = params.type === "opt_out" ? "opt_out" : params.type === "all" ? "all" : "suppressed";
      const contacts = await listContactsForExport(auth.tenantId, type);
      const csv = exportCsv(contacts);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="contacts-${type}.csv"`,
          "Access-Control-Allow-Origin": "*",
        },
        body: csv,
      };
    }

    if (method === "GET" && !phoneParam) {
      const limit = params.limit ? parseInt(params.limit, 10) : 50;
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return badRequest("Invalid limit (1-100)");
      }

      const consent = params.consent as MarketingConsent | undefined;
      if (consent && !["unknown", "opt_in", "opt_out"].includes(consent)) {
        return badRequest("Invalid consent filter");
      }

      const listOpts: Parameters<typeof listContacts>[1] = { limit };
      if (params.cursor) listOpts.cursor = params.cursor;
      if (params.tag) listOpts.tag = params.tag;
      if (consent) listOpts.consent = consent;
      if (params.suppressed === "true") listOpts.suppressed = true;
      if (params.suppressed === "false") listOpts.suppressed = false;
      if (params.q) listOpts.q = params.q;

      const result = await listContacts(auth.tenantId, listOpts);

      return ok(result);
    }

    if (method === "GET" && phoneParam) {
      const contact = await getContactByPhone(auth.tenantId, phoneParam);
      if (!contact) return notFound("Contact not found");
      return ok(contact);
    }

    if (method === "POST" && rawPath.endsWith("/contacts/import")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = ImportSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const tenant = await getTenant(auth.tenantId);
      if (tenant) {
        try {
          const current = await countContacts(auth.tenantId);
          await assertCanAddContacts(tenant, current + parsed.data.rows.length);
        } catch (err) {
          if (err instanceof PlanLimitError) {
            return handleError(err);
          }
          throw err;
        }
      }

      const rows = parsed.data.rows.map((row) => ({
        phone: row.phone,
        ...(row.name ? { name: row.name } : {}),
        ...(row.tags?.length ? { tags: row.tags } : {}),
        ...(row.marketingConsent ? { marketingConsent: row.marketingConsent } : {}),
      }));
      const result = await importContactsBatch(auth.tenantId, rows);
      return ok(result);
    }

    if (method === "POST" && !phoneParam && !rawPath.includes("/import")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateContactSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const phone = normalizePhone(parsed.data.phoneNumber);
      const existing = await getContactByPhone(auth.tenantId, phone);
      if (existing) return badRequest("Contact already exists");

      const tenant = await getTenant(auth.tenantId);
      if (tenant) {
        try {
          const current = await countContacts(auth.tenantId);
          await assertCanAddContacts(tenant, current + 1);
        } catch (err) {
          if (err instanceof PlanLimitError) return handleError(err);
          throw err;
        }
      }

      const now = new Date().toISOString();
      const consent = parsed.data.marketingConsent ?? "unknown";
      const contact = await createContact({
        phoneNumber: phone,
        tenantId: auth.tenantId,
        tags: parsed.data.tags ?? [],
        marketingConsent: consent,
        suppressed: false,
        firstSeenAt: now,
        lastSeenAt: now,
        source: "manual",
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.displayName ? { displayName: parsed.data.displayName } : {}),
        ...(consent !== "unknown"
          ? { consentAt: now, consentSource: "panel" as const }
          : {}),
      });

      if (consent !== "unknown") {
        await writeComplianceLog({
          tenantId: auth.tenantId,
          action: "consent_updated",
          phone,
          reason: consent,
          actorUserId: auth.userId,
        });
      }

      return created(contact);
    }

    if (method === "PATCH" && phoneParam) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateContactSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const phone = normalizePhone(phoneParam);
      const existing = await getContactByPhone(auth.tenantId, phone);
      if (!existing) return notFound("Contact not found");

      const now = new Date().toISOString();
      const patch: Parameters<typeof updateContact>[2] = {};
      if (parsed.data.displayName !== undefined) patch.displayName = parsed.data.displayName;
      if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags;
      if (parsed.data.suppressed !== undefined) patch.suppressed = parsed.data.suppressed;
      if (parsed.data.marketingConsent !== undefined) {
        patch.marketingConsent = parsed.data.marketingConsent;
        patch.consentAt = now;
        patch.consentSource = "panel";
      }

      const updated = await updateContact(auth.tenantId, phone, patch);
      if (!updated) return notFound("Contact not found");

      if (parsed.data.marketingConsent) {
        await writeComplianceLog({
          tenantId: auth.tenantId,
          action: "consent_updated",
          phone,
          reason: parsed.data.marketingConsent,
          actorUserId: auth.userId,
        });
      }
      if (parsed.data.suppressed === true) {
        await writeComplianceLog({
          tenantId: auth.tenantId,
          action: "suppressed",
          phone,
          reason: "panel",
          actorUserId: auth.userId,
        });
      }

      return ok(updated);
    }

    if (method === "DELETE" && phoneParam) {
      const phone = normalizePhone(phoneParam);
      const existing = await getContactByPhone(auth.tenantId, phone);
      if (!existing) return notFound("Contact not found");

      await suppressContact(auth.tenantId, phone);
      await writeComplianceLog({
        tenantId: auth.tenantId,
        action: "suppressed",
        phone,
        reason: "delete",
        actorUserId: auth.userId,
      });

      return noContent();
    }

    void parseSubPath;
    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
