import { getBot } from "../dynamodb/bot.repository.js";
import { getBotByMessengerPageId } from "../dynamodb/bot-lookup.repository.js";
import { getMessengerAccessToken } from "../messenger/secrets.js";
import { attributionFromLeadAds } from "./attribution.js";
import {
  buildLeadAdsFlowResponseId,
  createLeadFromAds,
  extractLeadAdsFieldValues,
  placeholderPhoneForLeadAds,
} from "./ads-lead.js";
import { fetchMetaLeadgenDetail } from "./graph.js";
import type { MetaLeadgenWebhookChange } from "../../types/index.js";

export async function processLeadgenWebhook(
  change: MetaLeadgenWebhookChange,
  environment: string
): Promise<void> {
  const pageId = change.value.page_id;
  const leadgenId = change.value.leadgen_id;
  if (!pageId || !leadgenId) return;

  const lookup = await getBotByMessengerPageId(pageId);
  if (!lookup) {
    console.log(`No bot for Lead Ads pageId: ${pageId}`);
    return;
  }

  const bot = await getBot(lookup.tenantId, lookup.botId);
  if (!bot || bot.status !== "active") return;

  const accessToken = await getMessengerAccessToken(lookup.tenantId, lookup.botId, environment);
  const detail = await fetchMetaLeadgenDetail(leadgenId, accessToken);
  const fields = extractLeadAdsFieldValues(detail.field_data ?? []);

  const attribution = attributionFromLeadAds({
    adId: change.value.ad_id ?? detail.ad_id,
    adSetId: change.value.adgroup_id ?? detail.adset_id,
    formId: change.value.form_id ?? detail.form_id,
    leadgenId,
  });

  const phone = fields.phone ?? placeholderPhoneForLeadAds(leadgenId);
  const notes = fields.notes.length ? fields.notes.join("\n") : undefined;

  await createLeadFromAds({
    tenantId: lookup.tenantId,
    botId: lookup.botId,
    phone,
    metaFlowId: "meta_lead_ads",
    flowResponseId: buildLeadAdsFlowResponseId(leadgenId),
    ...(fields.name ? { name: fields.name } : {}),
    ...(fields.email ? { email: fields.email } : {}),
    ...(notes ? { notes } : {}),
    attribution,
  });
}
