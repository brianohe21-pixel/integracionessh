import { randomUUID } from "crypto";
import { normalizePhone } from "../dynamodb/contact.repository.js";
import { createOpportunity } from "../dynamodb/opportunity.repository.js";
import { emitIntegrationEvent } from "../integrations/emit.js";
import { buildOpportunityCreatedPayload } from "../integrations/payloads.js";
import type { Opportunity, OpportunityStage } from "../../types/index.js";

const STAGES: OpportunityStage[] = ["new", "quoted", "negotiation", "won", "lost"];

function parseStage(value?: string): OpportunityStage {
  if (value && STAGES.includes(value as OpportunityStage)) {
    return value as OpportunityStage;
  }
  return "new";
}

function parseAmount(value?: string): number | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : undefined;
}

export async function createOpportunityFromFormData(params: {
  tenantId: string;
  botId?: string;
  title: string;
  amount?: string;
  currency?: string;
  stage?: string;
  phone?: string;
  name?: string;
  email?: string;
  description?: string;
  tags?: string[];
  leadId?: string;
  sourceId?: string;
}): Promise<Opportunity> {
  const title = params.title.trim();
  if (!title) throw new Error("Opportunity title is required");

  const now = new Date().toISOString();
  const opportunityId = randomUUID();
  const phone = params.phone ? normalizePhone(params.phone) : undefined;
  const amount = parseAmount(params.amount);
  const stage = parseStage(params.stage);
  const currency = params.currency?.trim() || "USD";

  const opportunity: Opportunity = {
    opportunityId,
    tenantId: params.tenantId,
    title,
    currency,
    stage,
    tags: params.tags ?? [],
    createdAt: now,
    updatedAt: now,
    ...(params.botId ? { botId: params.botId } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(phone ? { phone } : {}),
    ...(params.name ? { name: params.name } : {}),
    ...(params.email ? { email: params.email } : {}),
    ...(params.description ? { description: params.description } : {}),
    ...(params.leadId ? { leadId: params.leadId } : {}),
    ...(params.sourceId ? { sourceId: params.sourceId } : {}),
  };

  await createOpportunity(opportunity);

  await emitIntegrationEvent(
    params.tenantId,
    "opportunity.created",
    buildOpportunityCreatedPayload({
      tenantId: params.tenantId,
      opportunityId,
      title,
      currency,
      stage,
      ...(params.botId ? { botId: params.botId } : {}),
      ...(amount !== undefined ? { amount } : {}),
      ...(phone ? { phone } : {}),
      ...(params.name ? { name: params.name } : {}),
      ...(params.email ? { email: params.email } : {}),
    })
  ).catch((err) => console.error("Failed to emit opportunity.created:", err));

  return opportunity;
}
