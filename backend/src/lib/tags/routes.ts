import { randomUUID } from "crypto";
import { z } from "zod";
import { assertMemberRole } from "../auth/cognito.js";
import { getPipelineById, findStageById } from "../dynamodb/pipeline.repository.js";
import { getAdvisor } from "../dynamodb/advisor.repository.js";
import { getSequenceById } from "../dynamodb/sequence.repository.js";
import { getBot } from "../dynamodb/bot.repository.js";
import {
  createTag,
  deleteTag,
  getTagById,
  getTagByName,
  listTags,
  normalizeTagName,
  updateTag,
} from "../dynamodb/tag.repository.js";
import { ok, created, badRequest, notFound, noContent } from "../http.js";
import type { AuthContext, TagAction, TagDefinition } from "../../types/index.js";
import type { APIGatewayProxyResultV2 } from "aws-lambda";

const TagActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move_opportunity_stage"),
    pipelineId: z.string().min(1).max(64),
    stageId: z.string().min(1).max(64),
    openOnly: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("assign_advisor"),
    advisorId: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal("handoff"),
    advisorId: z.string().min(1).max(64).optional(),
  }),
  z.object({
    type: z.literal("enroll_sequence"),
    sequenceId: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal("create_task"),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    dueInHours: z.number().int().min(1).max(8760).optional(),
    advisorId: z.string().min(1).max(64).optional(),
    priority: z.enum(["low", "medium", "high", "highest"]).optional(),
  }),
  z.object({
    type: z.literal("set_consent"),
    marketingConsent: z.enum(["opt_in", "opt_out"]),
  }),
  z.object({
    type: z.literal("apply_tags"),
    tags: z.array(z.string().min(1).max(50)).min(1).max(20),
  }),
  z.object({
    type: z.literal("create_lead"),
    botId: z.string().min(1).max(64).optional(),
    tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  }),
]);

const CreateTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  description: z.string().max(500).optional(),
  onApply: z.array(TagActionSchema).max(10).optional(),
});

const UpdateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional(),
  description: z.string().max(500).nullable().optional(),
  onApply: z.array(TagActionSchema).max(10).optional(),
});

async function assertActionsValid(tenantId: string, actions: TagAction[]): Promise<string | null> {
  for (const action of actions) {
    switch (action.type) {
      case "move_opportunity_stage": {
        const pipeline = await getPipelineById(tenantId, action.pipelineId);
        if (!pipeline) return `Pipeline not found: ${action.pipelineId}`;
        const stage = findStageById(pipeline, action.stageId);
        if (!stage) return `Stage not found: ${action.stageId}`;
        break;
      }
      case "assign_advisor": {
        const advisor = await getAdvisor(tenantId, action.advisorId);
        if (!advisor || advisor.status !== "active") {
          return `Advisor not found or inactive: ${action.advisorId}`;
        }
        break;
      }
      case "handoff": {
        if (action.advisorId) {
          const advisor = await getAdvisor(tenantId, action.advisorId);
          if (!advisor || advisor.status !== "active") {
            return `Advisor not found or inactive: ${action.advisorId}`;
          }
        }
        break;
      }
      case "enroll_sequence": {
        const sequence = await getSequenceById(tenantId, action.sequenceId);
        if (!sequence) return `Sequence not found: ${action.sequenceId}`;
        if (!sequence.enabled) return `Sequence is disabled: ${action.sequenceId}`;
        break;
      }
      case "create_task": {
        if (action.advisorId) {
          const advisor = await getAdvisor(tenantId, action.advisorId);
          if (!advisor || advisor.status !== "active") {
            return `Advisor not found or inactive: ${action.advisorId}`;
          }
        }
        break;
      }
      case "create_lead": {
        if (action.botId) {
          const bot = await getBot(tenantId, action.botId);
          if (!bot) return `Bot not found: ${action.botId}`;
        }
        break;
      }
      case "set_consent":
      case "apply_tags":
        break;
    }
  }
  return null;
}

async function assertNameAvailable(
  tenantId: string,
  name: string,
  excludeTagId?: string
): Promise<void> {
  const existing = await getTagByName(tenantId, name);
  if (existing && existing.tagId !== excludeTagId) {
    const error = new Error("A tag with this name already exists");
    (error as Error & { statusCode: number }).statusCode = 400;
    throw error;
  }
}

export async function handleTagsRoutes(params: {
  auth: AuthContext;
  method: string;
  segments: string[];
  body: string | null | undefined;
}): Promise<APIGatewayProxyResultV2> {
  const { auth, method, segments, body } = params;
  const tagId = segments[0];

  if (method === "GET" && segments.length === 0) {
    const tags = await listTags(auth.tenantId);
    return ok({ items: tags });
  }

  if (method === "GET" && tagId && segments.length === 1) {
    const tag = await getTagById(auth.tenantId, tagId);
    if (!tag) return notFound("Tag not found");
    return ok(tag);
  }

  assertMemberRole(auth);

  if (method === "POST" && segments.length === 0) {
    const parsed = CreateTagSchema.safeParse(JSON.parse(body ?? "{}"));
    if (!parsed.success) return badRequest(parsed.error.message);

    const name = parsed.data.name.trim();
    if (!normalizeTagName(name)) return badRequest("Tag name is required");

    await assertNameAvailable(auth.tenantId, name);
    const onApply = (parsed.data.onApply ?? []) as TagAction[];
    const actionError = await assertActionsValid(auth.tenantId, onApply);
    if (actionError) return badRequest(actionError);

    const now = new Date().toISOString();
    const tag: TagDefinition = {
      tagId: randomUUID(),
      tenantId: auth.tenantId,
      name,
      onApply,
      createdAt: now,
      updatedAt: now,
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
      ...(parsed.data.description?.trim()
        ? { description: parsed.data.description.trim() }
        : {}),
    };

    await createTag(tag);
    return created(tag);
  }

  if (!tagId) return badRequest("tagId required");

  if (method === "PUT" && segments.length === 1) {
    const parsed = UpdateTagSchema.safeParse(JSON.parse(body ?? "{}"));
    if (!parsed.success) return badRequest(parsed.error.message);

    const existing = await getTagById(auth.tenantId, tagId);
    if (!existing) return notFound("Tag not found");

    const updates: Parameters<typeof updateTag>[2] = {};
    if (parsed.data.name !== undefined) {
      const name = parsed.data.name.trim();
      if (!normalizeTagName(name)) return badRequest("Tag name is required");
      await assertNameAvailable(auth.tenantId, name, tagId);
      updates.name = name;
    }
    if (parsed.data.color !== undefined) {
      updates.color = parsed.data.color;
    }
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description?.trim() || null;
    }
    if (parsed.data.onApply !== undefined) {
      const onApply = parsed.data.onApply as TagAction[];
      const actionError = await assertActionsValid(auth.tenantId, onApply);
      if (actionError) return badRequest(actionError);
      updates.onApply = onApply;
    }

    const updated = await updateTag(auth.tenantId, tagId, updates);
    if (!updated) return notFound("Tag not found");
    return ok(updated);
  }

  if (method === "DELETE" && segments.length === 1) {
    const deleted = await deleteTag(auth.tenantId, tagId);
    if (!deleted) return notFound("Tag not found");
    return noContent();
  }

  return badRequest("Method not allowed");
}
