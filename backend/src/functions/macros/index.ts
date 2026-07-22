import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  extractAuthContext,
  assertMemberRole,
  assertAdvisorOrMember,
} from "../../lib/auth/cognito.js";
import type { AuthContext } from "../../types/index.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getAdvisorByCognitoUserId } from "../../lib/dynamodb/advisor.repository.js";
import {
  createMacro,
  deleteMacro,
  getMacro,
  getMacroByShortcut,
  listMacros,
  updateMacro,
} from "../../lib/dynamodb/macro.repository.js";
import { ok, created, badRequest, notFound, noContent, handleError } from "../../lib/http.js";
import type { Macro } from "../../types/index.js";

const CreateMacroSchema = z.object({
  title: z.string().min(1).max(128),
  content: z.string().min(1).max(1024),
  shortcut: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-zA-Z0-9-]+$/)
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const UpdateMacroSchema = z.object({
  title: z.string().min(1).max(128).optional(),
  content: z.string().min(1).max(1024).optional(),
  shortcut: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-zA-Z0-9-]+$/)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

async function assertAdvisorBotAccess(auth: AuthContext, botId: string): Promise<void> {
  if (auth.role !== "advisor") return;

  const advisor = await getAdvisorByCognitoUserId(auth.tenantId, auth.userId);
  if (!advisor) {
    const error = new Error("Access denied");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }

  if (advisor.botIds?.length && !advisor.botIds.includes(botId)) {
    const error = new Error("Access denied to this bot");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}

async function assertShortcutAvailable(
  tenantId: string,
  botId: string,
  shortcut: string | undefined,
  excludeMacroId?: string
): Promise<void> {
  if (!shortcut) return;

  const existing = await getMacroByShortcut(tenantId, botId, shortcut);
  if (existing && existing.macroId !== excludeMacroId) {
    const error = new Error("A macro with this shortcut already exists");
    (error as Error & { statusCode: number }).statusCode = 400;
    throw error;
  }
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const method = event.requestContext.http.method;
    const botId = event.pathParameters?.botId;
    const macroId = event.pathParameters?.macroId;

    if (!botId) return badRequest("botId required");

    const bot = await getBot(auth.tenantId, botId);
    if (!bot) return notFound("Bot not found");

    if (method === "GET" && !macroId) {
      assertAdvisorOrMember(auth);
      await assertAdvisorBotAccess(auth, botId);
      const macros = await listMacros(auth.tenantId, botId);
      return ok({ macros });
    }

    if (method === "GET" && macroId) {
      assertAdvisorOrMember(auth);
      await assertAdvisorBotAccess(auth, botId);
      const macro = await getMacro(auth.tenantId, botId, macroId);
      if (!macro) return notFound("Macro not found");
      return ok(macro);
    }

    assertMemberRole(auth);

    if (method === "POST" && !macroId) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateMacroSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      await assertShortcutAvailable(auth.tenantId, botId, parsed.data.shortcut);

      const now = new Date().toISOString();
      const macro: Macro = {
        macroId: randomUUID(),
        tenantId: auth.tenantId,
        botId,
        title: parsed.data.title,
        content: parsed.data.content,
        createdAt: now,
        updatedAt: now,
        ...(parsed.data.shortcut ? { shortcut: parsed.data.shortcut } : {}),
        ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
      };

      await createMacro(macro);
      return created(macro);
    }

    if (!macroId) return badRequest("macroId required");

    if (method === "PUT") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateMacroSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const existing = await getMacro(auth.tenantId, botId, macroId);
      if (!existing) return notFound("Macro not found");

      if (parsed.data.shortcut) {
        await assertShortcutAvailable(auth.tenantId, botId, parsed.data.shortcut, macroId);
      }

      const updates: Parameters<typeof updateMacro>[3] = {};
      if (parsed.data.title !== undefined) updates.title = parsed.data.title;
      if (parsed.data.content !== undefined) updates.content = parsed.data.content;
      if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder;
      if (parsed.data.shortcut !== undefined) {
        updates.shortcut = parsed.data.shortcut;
      }

      const updated = await updateMacro(auth.tenantId, botId, macroId, updates);
      return ok(updated);
    }

    if (method === "DELETE") {
      const deleted = await deleteMacro(auth.tenantId, botId, macroId);
      if (!deleted) return notFound("Macro not found");
      return noContent();
    }

    return badRequest("Method not allowed");
  } catch (error) {
    return handleError(error);
  }
}
