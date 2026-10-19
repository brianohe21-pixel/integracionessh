import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import {
  buildBindingContext,
  conversationBindingFromContext,
  resolveBindingValue,
  resolveContactIdentity,
} from "../binding.js";
import { getNextNodeId } from "../graph.js";
import { applyTagsToContact } from "../../tags/apply.js";
import { normalizeTagName } from "../../dynamodb/tag.repository.js";
import {
  getActiveLeadByPhone,
  updateLead,
} from "../../dynamodb/lead.repository.js";

function normalizeTagList(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    const key = normalizeTagName(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export async function executeAssignTagsNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  run: FlowRun
): Promise<NodeExecutionResult> {
  const bindingContext = buildBindingContext({
    formPayload: ctx.formPayload,
    variables: run.variables,
    conversation: conversationBindingFromContext(ctx),
  });

  const phone = resolveContactIdentity(
    resolveBindingValue(
      node.data.contactPhoneBinding ?? "{{phone}}",
      bindingContext
    )
  );
  if (!phone) {
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id),
      halt: false,
      wait: false,
      error: "Valid phone binding is required",
      output: "skipped: missing phone",
    };
  }

  const tags = normalizeTagList(node.data.contactTags);
  if (!tags.length) {
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id),
      halt: false,
      wait: false,
      error: "At least one tag is required",
      output: "skipped: missing tags",
    };
  }

  const updated = await applyTagsToContact({
    tenantId: ctx.tenantId,
    phone,
    tagsToAdd: tags,
    changedBy: "flow:assign_tags",
  });

  if (!updated) {
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id),
      halt: false,
      wait: false,
      error: "Contact not found",
      output: "skipped: contact not found",
    };
  }

  const lead = await getActiveLeadByPhone(ctx.tenantId, phone);
  if (lead) {
    const leadTags = [...new Set([...lead.tags, ...tags])];
    if (leadTags.length !== lead.tags.length) {
      await updateLead(ctx.tenantId, lead.leadId, { tags: leadTags });
    }
  }

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: { contact_phone: phone },
    output: tags.join(", "),
  };
}
