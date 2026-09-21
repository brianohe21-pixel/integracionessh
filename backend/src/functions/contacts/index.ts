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
import { buildCustomerCsatMap } from "../../lib/dynamodb/customer-csat-metrics.js";
import { listAllConversationsForTenant } from "../../lib/dynamodb/metrics.repository.js";
import { writeComplianceLog } from "../../lib/compliance/audit-log.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanAddContacts } from "../../lib/billing/assert-plan.js";
import { PlanLimitError } from "../../lib/billing/plan-limits.js";
import {
  resolveRequestAuth,
  assertMemberRole,
} from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import {
  ok,
  created,
  noContent,
  badRequest,
  notFound,
  handleError,
} from "../../lib/http.js";
import { enrichContactCountry } from "../../lib/phone/country-from-phone.js";
import type {
  Contact,
  ContactDateField,
  ContactSortField,
  MarketingConsent,
} from "../../types/index.js";

const CONTACT_SORT_FIELDS = new Set<ContactSortField>([
  "updated",
  "lastSeen",
  "created",
  "name",
  "csat",
]);

const CONTACT_DATE_FIELDS = new Set<ContactDateField>(["firstSeen", "lastSeen", "created"]);

const CreateContactSchema = z.object({
  phoneNumber: z.string().min(10).max(20),
  displayName: z.string().max(128).optional(),
  email: z.string().email().max(256).optional(),
  country: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  marketingConsent: z.enum(["unknown", "opt_in", "opt_out"]).optional(),
});

const UpdateContactSchema = z.object({
  displayName: z.string().max(128).optional(),
  email: z.string().email().max(256).optional(),
  country: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(4000).optional(),
  marketingConsent: z.enum(["unknown", "opt_in", "opt_out"]).optional(),
  suppressed: z.boolean().optional(),
});

const ImportSchema = z.object({
  rows: z
    .array(
      z.object({
        phone: z.string().min(10),
        name: z.string().max(128).optional(),
        email: z.string().email().max(256).optional(),
        country: z.string().max(100).optional(),
        company: z.string().max(200).optional(),
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
  const header = "phone,displayName,email,country,company,marketingConsent,suppressed,tags,notes";
  const rows = contacts.map((c) => {
    const tags = c.tags.join("|");
    const name = (c.displayName ?? "").replace(/"/g, '""');
    const email = (c.email ?? "").replace(/"/g, '""');
    const country = (c.country ?? "").replace(/"/g, '""');
    const company = (c.company ?? "").replace(/"/g, '""');
    const notes = (c.notes ?? "").replace(/"/g, '""');
    return `${c.phoneNumber},"${name}","${email}","${country}","${company}",${c.marketingConsent},${c.suppressed},"${tags}","${notes}"`;
  });
  return [header, ...rows].join("\n");
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "contacts");

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

      const sortParam = params.sort?.trim() as ContactSortField | undefined;
      if (sortParam && !CONTACT_SORT_FIELDS.has(sortParam)) {
        return badRequest("Invalid sort field");
      }

      const listOpts: Parameters<typeof listContacts>[1] = { limit };
      if (params.cursor) listOpts.cursor = params.cursor;
      if (params.tag) listOpts.tag = params.tag;
      if (consent) listOpts.consent = consent;
      if (params.suppressed === "true") listOpts.suppressed = true;
      if (params.suppressed === "false") listOpts.suppressed = false;
      if (params.q) listOpts.q = params.q;
      if (params.country) listOpts.country = params.country;
      if (params.company) listOpts.company = params.company;
      const botId = params.botId?.trim();
      if (botId) listOpts.botId = botId;
      if (sortParam) listOpts.sort = sortParam;
      const from = params.from?.trim();
      const to = params.to?.trim();
      const dateField = params.dateField?.trim() as ContactDateField | undefined;
      if ((from && !to) || (!from && to)) {
        return badRequest("Both from and to are required for date filtering");
      }
      if (from && to) {
        listOpts.from = from;
        listOpts.to = to;
      }
      if (dateField) {
        if (!CONTACT_DATE_FIELDS.has(dateField)) {
          return badRequest("Invalid date field");
        }
        listOpts.dateField = dateField;
      }

      const conversations = await listAllConversationsForTenant(auth.tenantId);
      const csatMap = buildCustomerCsatMap(conversations);
      const result = await listContacts(auth.tenantId, listOpts, csatMap);

      return ok({
        ...result,
        items: result.items.map((contact) => {
          const enriched = enrichContactCountry(contact);
          if (contact.csatAverage !== undefined) return enriched;
          const csat = csatMap.get(contact.phoneNumber);
          if (!csat) return enriched;
          return {
            ...enriched,
            csatAverage: csat.averageCsat,
            csatRatingCount: csat.ratingCount,
          };
        }),
      });
    }

    if (method === "GET" && phoneParam) {
      const contact = await getContactByPhone(auth.tenantId, phoneParam);
      if (!contact) return notFound("Contact not found");
      return ok(enrichContactCountry(contact));
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
        ...(row.email ? { email: row.email } : {}),
        ...(row.country ? { country: row.country } : {}),
        ...(row.company ? { company: row.company } : {}),
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
        ...(parsed.data.email ? { email: parsed.data.email } : {}),
        ...(parsed.data.country ? { country: parsed.data.country } : {}),
        ...(parsed.data.company ? { company: parsed.data.company } : {}),
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
      if (parsed.data.email !== undefined) patch.email = parsed.data.email;
      if (parsed.data.country !== undefined) patch.country = parsed.data.country;
      if (parsed.data.company !== undefined) patch.company = parsed.data.company;
      if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags;
      if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
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
