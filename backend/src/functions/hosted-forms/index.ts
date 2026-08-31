import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { createHash } from "crypto";
import { z } from "zod";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { assertCanCreateHostedForm } from "../../lib/billing/assert-plan.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getFlowDefinition, listFlowDefinitions } from "../../lib/dynamodb/flow.repository.js";
import { getResolvedBrandingWithInheritance } from "../../lib/branding/inherit.js";
import {
  createHostedForm,
  deleteFormPublicKeyLookup,
  deleteHostedForm,
  getFormByPublicKey,
  getHostedForm,
  listHostedFormSubmissions,
  listHostedForms,
  makeHostedFormId,
  putFormPublicKeyLookup,
  updateHostedForm,
} from "../../lib/dynamodb/hosted-form.repository.js";
import { isWebhookReceivingFlow } from "../../lib/flow/webhook-flow.js";
import {
  buildFormEmbedSnippet,
  buildPublicFormUrl,
  generateFormPublicKey,
} from "../../lib/hosted-forms/public-link.js";
import { submitHostedForm } from "../../lib/hosted-forms/submit.js";
import {
  defaultCrmMapping,
  defaultHostedFormFields,
  toPublicForm,
  validateFormDefinition,
} from "../../lib/hosted-forms/validate.js";
import type { HostedForm, HostedFormCrmMapping, HostedFormField } from "../../types/index.js";
import { checkAndIncrement } from "../../lib/rate-limiter/index.js";
import {
  ok,
  created,
  badRequest,
  notFound,
  noContent,
  handleError,
  parseJsonBody,
} from "../../lib/http.js";

const MAX_PAYLOAD_BYTES = 64 * 1024;
const RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_PER_DAY = 200;

const FieldOptionSchema = z.object({
  value: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
});

const FieldSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum([
    "text",
    "email",
    "phone",
    "textarea",
    "number",
    "select",
    "checkbox",
    "radio",
    "date",
    "hidden",
  ]),
  name: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  placeholder: z.string().max(200).optional(),
  helperText: z.string().max(300).optional(),
  required: z.boolean(),
  options: z.array(FieldOptionSchema).max(30).optional(),
  defaultValue: z.string().max(500).optional(),
});

const CrmMappingSchema = z.object({
  name: z.string().max(40).optional(),
  email: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
});

const CreateFormSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  botId: z.string().uuid().optional(),
  fields: z.array(FieldSchema).min(1).max(40).optional(),
  submitLabel: z.string().min(1).max(80).optional(),
  successTitle: z.string().min(1).max(120).optional(),
  successMessage: z.string().min(1).max(500).optional(),
  redirectUrl: z.string().url().max(500).optional(),
  flowId: z.string().uuid().optional(),
  crmMapping: CrmMappingSchema.optional(),
  createLeadOnSubmit: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});

const UpdateFormSchema = CreateFormSchema.partial();

function withPublicMeta(form: HostedForm) {
  return {
    ...form,
    publicUrl: form.published ? buildPublicFormUrl(form.publicKey) : undefined,
    embedSnippet: form.published ? buildFormEmbedSnippet(form.publicKey) : undefined,
  };
}

function parseFormsPath(rawPath: string): string[] {
  const normalized = rawPath.replace(/\/+$/, "");
  if (normalized.startsWith("/public/forms/")) {
    return normalized.slice("/public/forms/".length).split("/").filter(Boolean);
  }
  if (normalized === "/forms") return [];
  if (normalized.startsWith("/forms/")) {
    return normalized.slice("/forms/".length).split("/").filter(Boolean);
  }
  return [];
}

async function assertBot(tenantId: string, botId: string): Promise<void> {
  const bot = await getBot(tenantId, botId);
  if (!bot) {
    const err = new Error("Bot not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
}

async function assertFlow(tenantId: string, flowId: string): Promise<void> {
  const flow = await getFlowDefinition(tenantId, flowId);
  if (!flow) {
    const err = new Error("Flow not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  if (!isWebhookReceivingFlow(flow.nodes)) {
    const err = new Error("Linked flow must use the web form trigger") as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    throw err;
  }
}

function normalizeFields(fields: HostedFormField[]): HostedFormField[] {
  return fields.map((field) => {
    const next: HostedFormField = {
      id: field.id,
      type: field.type,
      name: field.name.trim(),
      label: field.label.trim(),
      required: Boolean(field.required),
    };
    if (field.placeholder) next.placeholder = field.placeholder;
    if (field.helperText) next.helperText = field.helperText;
    if (field.options?.length) next.options = field.options;
    if (field.defaultValue) next.defaultValue = field.defaultValue;
    return next;
  });
}

function normalizeMapping(mapping?: {
  name?: string;
  email?: string;
  phone?: string;
}): HostedFormCrmMapping {
  if (!mapping) return defaultCrmMapping();
  const result: HostedFormCrmMapping = {};
  if (mapping.name) result.name = mapping.name;
  if (mapping.email) result.email = mapping.email;
  if (mapping.phone) result.phone = mapping.phone;
  return result;
}

async function handlePublic(
  event: APIGatewayProxyEventV2,
  method: string,
  segments: string[]
): Promise<APIGatewayProxyResultV2> {
  const publicKey = segments[0];
  if (!publicKey) return badRequest("publicKey is required");

  if (method === "GET" && segments.length === 1) {
    const lookup = await getFormByPublicKey(publicKey);
    if (!lookup) return notFound("Form not found");
    const form = await getHostedForm(lookup.tenantId, lookup.formId);
    if (!form || !form.published || form.publicKey !== publicKey) {
      return notFound("Form not found");
    }
    const tenant = await getTenant(form.tenantId);
    const branding = tenant ? await getResolvedBrandingWithInheritance(tenant) : undefined;
    return ok({
      ...toPublicForm(form),
      ...(branding
        ? {
            branding: {
              brandName: branding.brandName,
              primaryColor: branding.primaryColor,
              ...(branding.logoUrl ? { logoUrl: branding.logoUrl } : {}),
            },
          }
        : {}),
    });
  }

  if (method === "POST" && segments[1] === "submit" && segments.length === 2) {
    const lookup = await getFormByPublicKey(publicKey);
    if (!lookup) return notFound("Form not found");
    const form = await getHostedForm(lookup.tenantId, lookup.formId);
    if (!form || !form.published || form.publicKey !== publicKey) {
      return notFound("Form not found");
    }

    const rawBody = event.body ?? "";
    if (Buffer.byteLength(rawBody, "utf8") > MAX_PAYLOAD_BYTES) {
      return badRequest("Payload too large");
    }

    const rateKey = createHash("sha256").update(`hosted-form:${publicKey}`).digest("hex");
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

    const body = parseJsonBody(event);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("Payload must be a JSON object");
    }

    const submission = await submitHostedForm({
      form,
      rawPayload: body as Record<string, unknown>,
    });
    return created({
      submissionId: submission.submissionId,
      ...(form.redirectUrl ? { redirectUrl: form.redirectUrl } : {}),
    });
  }

  return notFound();
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
    const segments = parseFormsPath(rawPath);

    if (rawPath.startsWith("/public/forms")) {
      return handlePublic(event, method, segments);
    }

    const auth = await resolveRequestAuth(event as APIGatewayProxyEventV2WithJWTAuthorizer);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "flows");
    const formId = segments[0];

    if (method === "GET" && segments.length === 0) {
      const forms = await listHostedForms(auth.tenantId);
      return ok({ items: forms.map(withPublicMeta) });
    }

    if (method === "POST" && segments.length === 0) {
      const tenant = await getTenant(auth.tenantId);
      if (!tenant) return notFound("Tenant not found");
      await assertCanCreateHostedForm(tenant);
      const body = CreateFormSchema.parse(parseJsonBody(event));
      if (body.botId) await assertBot(auth.tenantId, body.botId);
      if (body.flowId) await assertFlow(auth.tenantId, body.flowId);
      const fields = normalizeFields((body.fields ?? defaultHostedFormFields()) as HostedFormField[]);
      const crmMapping = normalizeMapping(body.crmMapping as HostedFormCrmMapping | undefined);
      const createLeadOnSubmit = body.createLeadOnSubmit ?? false;
      validateFormDefinition({
        fields,
        crmMapping,
        createLeadOnSubmit,
        ...(body.botId ? { botId: body.botId } : {}),
        ...(body.redirectUrl ? { redirectUrl: body.redirectUrl } : {}),
      });
      const now = new Date().toISOString();
      const form = await createHostedForm({
        formId: makeHostedFormId(),
        tenantId: auth.tenantId,
        name: body.name.trim(),
        published: false,
        publicKey: generateFormPublicKey(),
        fields,
        submitLabel: body.submitLabel?.trim() || "Submit",
        successTitle: body.successTitle?.trim() || "Thanks",
        successMessage: body.successMessage?.trim() || "We received your response.",
        crmMapping,
        createLeadOnSubmit,
        createdAt: now,
        updatedAt: now,
        ...(body.description?.trim() ? { description: body.description.trim() } : {}),
        ...(body.botId ? { botId: body.botId } : {}),
        ...(body.redirectUrl ? { redirectUrl: body.redirectUrl } : {}),
        ...(body.flowId ? { flowId: body.flowId } : {}),
        ...(body.tags?.length ? { tags: body.tags } : {}),
      });
      return created(withPublicMeta(form));
    }

    if (method === "GET" && formId === "flow-options" && segments.length === 1) {
      const flows = await listFlowDefinitions(auth.tenantId);
      const items = flows
        .filter((flow) => isWebhookReceivingFlow(flow.nodes))
        .map((flow) => ({
          flowId: flow.flowId,
          name: flow.name,
          enabled: flow.enabled,
        }));
      return ok({ items });
    }

    if (!formId) return badRequest("formId is required");

    if (method === "GET" && segments.length === 1) {
      const form = await getHostedForm(auth.tenantId, formId);
      if (!form) return notFound("Form not found");
      return ok(withPublicMeta(form));
    }

    if (method === "GET" && segments[1] === "submissions") {
      const form = await getHostedForm(auth.tenantId, formId);
      if (!form) return notFound("Form not found");
      const items = await listHostedFormSubmissions(auth.tenantId, formId);
      return ok({ items });
    }

    if (method === "PUT" && segments.length === 1) {
      const existing = await getHostedForm(auth.tenantId, formId);
      if (!existing) return notFound("Form not found");
      const body = UpdateFormSchema.parse(parseJsonBody(event));
      if (body.botId) await assertBot(auth.tenantId, body.botId);
      if (body.flowId) await assertFlow(auth.tenantId, body.flowId);
      const fields = normalizeFields((body.fields ?? existing.fields) as HostedFormField[]);
      const crmMapping = body.crmMapping
        ? normalizeMapping(body.crmMapping as HostedFormCrmMapping)
        : existing.crmMapping;
      const createLeadOnSubmit = body.createLeadOnSubmit ?? existing.createLeadOnSubmit;
      const botId = body.botId ?? existing.botId;
      const redirectUrl = body.redirectUrl ?? existing.redirectUrl;
      validateFormDefinition({
        fields,
        crmMapping,
        createLeadOnSubmit,
        ...(botId ? { botId } : {}),
        ...(redirectUrl ? { redirectUrl } : {}),
      });
      const updates: Partial<HostedForm> = {};
      if (body.name !== undefined) updates.name = body.name.trim();
      if (body.description !== undefined && body.description.trim()) {
        updates.description = body.description.trim();
      }
      if (body.botId) updates.botId = body.botId;
      if (body.fields) updates.fields = fields;
      if (body.submitLabel !== undefined) updates.submitLabel = body.submitLabel.trim();
      if (body.successTitle !== undefined) updates.successTitle = body.successTitle.trim();
      if (body.successMessage !== undefined) updates.successMessage = body.successMessage.trim();
      if (body.redirectUrl) updates.redirectUrl = body.redirectUrl;
      if (body.flowId) updates.flowId = body.flowId;
      if (body.crmMapping) updates.crmMapping = crmMapping;
      if (body.createLeadOnSubmit !== undefined) updates.createLeadOnSubmit = createLeadOnSubmit;
      if (body.tags) updates.tags = body.tags;
      const updated = await updateHostedForm(auth.tenantId, formId, updates);
      if (!updated) return notFound("Form not found");
      return ok(withPublicMeta(updated));
    }

    if (method === "POST" && segments[1] === "publish") {
      const existing = await getHostedForm(auth.tenantId, formId);
      if (!existing) return notFound("Form not found");
      validateFormDefinition({
        fields: existing.fields,
        crmMapping: existing.crmMapping,
        createLeadOnSubmit: existing.createLeadOnSubmit,
        ...(existing.botId ? { botId: existing.botId } : {}),
        ...(existing.redirectUrl ? { redirectUrl: existing.redirectUrl } : {}),
      });
      if (existing.flowId) await assertFlow(auth.tenantId, existing.flowId);
      const updated = await updateHostedForm(auth.tenantId, formId, { published: true });
      if (!updated) return notFound("Form not found");
      return ok(withPublicMeta(updated));
    }

    if (method === "POST" && segments[1] === "unpublish") {
      const updated = await updateHostedForm(auth.tenantId, formId, { published: false });
      if (!updated) return notFound("Form not found");
      return ok(withPublicMeta(updated));
    }

    if (method === "POST" && segments[1] === "rotate-key") {
      const existing = await getHostedForm(auth.tenantId, formId);
      if (!existing) return notFound("Form not found");
      await deleteFormPublicKeyLookup(existing.publicKey);
      const publicKey = generateFormPublicKey();
      await putFormPublicKeyLookup(publicKey, auth.tenantId, formId);
      const updated = await updateHostedForm(auth.tenantId, formId, { publicKey });
      if (!updated) return notFound("Form not found");
      return ok(withPublicMeta(updated));
    }

    if (method === "DELETE" && segments.length === 1) {
      const deleted = await deleteHostedForm(auth.tenantId, formId);
      if (!deleted) return notFound("Form not found");
      return noContent();
    }

    return notFound();
  } catch (err) {
    if (err instanceof SyntaxError) {
      return badRequest("Invalid JSON payload");
    }
    return handleError(err);
  }
}
