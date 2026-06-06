import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { randomUUID } from "crypto";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanAddKnowledgeDocument } from "../../lib/billing/assert-plan.js";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  makeDocId,
} from "../../lib/dynamodb/knowledge.repository.js";
import { buildKnowledgeS3Key, getPresignedUploadUrl, deleteObject } from "../../lib/s3/client.js";
import { ok, created, badRequest, notFound, noContent, handleError } from "../../lib/http.js";

const sqs = new SQSClient({});
const KNOWLEDGE_QUEUE_URL = process.env.KNOWLEDGE_SQS_QUEUE_URL ?? "";

const UploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? "";
    const botId = event.pathParameters?.botId;
    const docId = event.pathParameters?.docId;

    if (!botId) return badRequest("botId required");

    const bot = await getBot(auth.tenantId, botId);
    if (!bot) return notFound("Bot not found");

    if (method === "GET" && rawPath.endsWith("/knowledge") && !docId) {
      const documents = await listDocuments(auth.tenantId, botId);
      return ok({ documents });
    }

    if (method === "POST" && rawPath.endsWith("/upload-url")) {
      const body = UploadUrlSchema.parse(JSON.parse(event.body ?? "{}"));
      const tenant = await getTenant(auth.tenantId);
      if (tenant) {
        await assertCanAddKnowledgeDocument(tenant, botId, body.sizeBytes);
      }

      const newDocId = makeDocId();
      const s3Key = buildKnowledgeS3Key(auth.tenantId, botId, newDocId, body.filename);
      const uploadUrl = await getPresignedUploadUrl(s3Key, body.mimeType);

      const doc = await createDocument({
        docId: newDocId,
        tenantId: auth.tenantId,
        botId,
        filename: body.filename,
        mimeType: body.mimeType,
        s3Key,
        sizeBytes: body.sizeBytes,
        status: "pending",
      });

      return created({ document: doc, uploadUrl });
    }

    if (method === "POST" && docId && rawPath.endsWith("/index")) {
      const doc = await getDocument(auth.tenantId, botId, docId);
      if (!doc) return notFound("Document not found");

      if (!KNOWLEDGE_QUEUE_URL) return badRequest("Knowledge indexing queue not configured");

      await sqs.send(
        new SendMessageCommand({
          QueueUrl: KNOWLEDGE_QUEUE_URL,
          MessageBody: JSON.stringify({
            tenantId: auth.tenantId,
            botId,
            docId,
          }),
          MessageGroupId: docId,
          MessageDeduplicationId: `${docId}-index-${randomUUID()}`,
        })
      );

      return ok({ message: "Indexing queued", docId });
    }

    if (method === "DELETE" && docId) {
      const doc = await getDocument(auth.tenantId, botId, docId);
      if (!doc) return notFound("Document not found");

      await deleteObject(doc.s3Key);
      await deleteDocument(auth.tenantId, botId, docId);
      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
