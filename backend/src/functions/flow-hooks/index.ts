import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { createHash } from "crypto";
import { getFlowDefinition } from "../../lib/dynamodb/flow.repository.js";
import { getFlowHookByKey } from "../../lib/dynamodb/flow-hook.repository.js";
import {
  createFlowEventSubmission,
  getFlowEventIdempotencyRecord,
  getFlowEventSubmission,
  putFlowEventIdempotencyRecord,
} from "../../lib/dynamodb/flow-event.repository.js";
import {
  enqueueFlowEventSubmission,
  makeSubmissionId,
} from "../../lib/flow/enqueue-event.js";
import { hashFlowHookSecret, timingSafeEqual } from "../../lib/flow/hook-credentials.js";
import { checkAndIncrement } from "../../lib/rate-limiter/index.js";
import { emitIntegrationEvent } from "../../lib/integrations/emit.js";
import { accepted, badRequest, handleError } from "../../lib/http.js";

const MAX_PAYLOAD_BYTES = 64 * 1024;
const RATE_LIMIT_PER_MINUTE = 30;
const RATE_LIMIT_PER_DAY = 1000;

const CORS_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Flow-Secret, Idempotency-Key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function parsePayload(body: string | undefined): Record<string, unknown> {
  if (!body) return {};
  const parsed = JSON.parse(body) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Payload must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    if (method === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS };
    }

    const hookKey = event.pathParameters?.hookKey;
    if (!hookKey) return json(400, { error: "hookKey is required" });
    if (method !== "POST") return json(405, { error: "Method not allowed" });

    const secret = event.headers["x-flow-secret"] ?? event.headers["X-Flow-Secret"];
    if (!secret) return json(401, { error: "X-Flow-Secret header is required" });

    const hook = await getFlowHookByKey(hookKey);
    if (!hook || !hook.enabled) return json(401, { error: "Invalid hook" });

    const secretHash = hashFlowHookSecret(secret);
    if (!timingSafeEqual(secretHash, hook.secretHash)) {
      return json(401, { error: "Invalid hook secret" });
    }

    const rateKey = createHash("sha256").update(`flow-hook:${hookKey}`).digest("hex");
    const rate = await checkAndIncrement(rateKey, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_PER_DAY);
    if (!rate.allowed) {
      return {
        statusCode: 429,
        headers: {
          ...CORS_HEADERS,
          ...(rate.retryAfterSeconds
            ? { "Retry-After": String(rate.retryAfterSeconds) }
            : {}),
        },
        body: JSON.stringify({ error: "Rate limit exceeded" }),
      };
    }

    const rawBody = event.body ?? "";
    if (Buffer.byteLength(rawBody, "utf8") > MAX_PAYLOAD_BYTES) {
      return json(400, { error: "Payload too large" });
    }

    const payload = parsePayload(rawBody);
    const flow = await getFlowDefinition(hook.tenantId, hook.flowId);
    if (!flow || !flow.enabled) {
      return json(400, { error: "Flow is not published" });
    }

    const trigger = flow.nodes.find((node) => node.type === "trigger");
    if (trigger?.data.triggerType !== "web_form_submitted") {
      return json(400, { error: "Flow is not configured for web forms" });
    }

    const idempotencyKey =
      event.headers["idempotency-key"] ?? event.headers["Idempotency-Key"];
    if (idempotencyKey) {
      const existingSubmissionId = await getFlowEventIdempotencyRecord(
        hook.tenantId,
        hook.flowId,
        idempotencyKey
      );
      if (existingSubmissionId) {
        const existing = await getFlowEventSubmission(hook.tenantId, existingSubmissionId);
        if (existing) {
          return json(202, {
            submissionId: existing.submissionId,
            status: existing.status,
            duplicate: true,
          });
        }
      }
    }

    const now = new Date().toISOString();
    const submissionId = makeSubmissionId();
    const submission = await createFlowEventSubmission({
      submissionId,
      tenantId: hook.tenantId,
      flowId: hook.flowId,
      hookKey,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      payload,
      status: "accepted",
      createdAt: now,
      updatedAt: now,
    });

    if (idempotencyKey) {
      await putFlowEventIdempotencyRecord({
        tenantId: hook.tenantId,
        flowId: hook.flowId,
        idempotencyKey,
        submissionId,
        createdAt: now,
      });
    }

    await enqueueFlowEventSubmission(submission);

    await emitIntegrationEvent(hook.tenantId, "form.submitted", {
      event: "form.submitted",
      timestamp: now,
      tenantId: hook.tenantId,
      data: {
        flowId: hook.flowId,
        botId: hook.botId,
        submissionId,
        hookKey,
        payload,
      },
    }).catch((err) => console.error("Failed to emit form.submitted:", err));

    return accepted({
      submissionId,
      status: submission.status,
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return badRequest("Invalid JSON payload");
    }
    return handleError(err);
  }
}
