import {
  getContactByPhone,
  normalizePhone,
  upsertFromConversation,
  updateContact,
} from "../../dynamodb/contact.repository.js";

export async function upsertCoexistenceContact(params: {
  tenantId: string;
  botId: string;
  phone: string;
  displayName?: string;
  action: "add" | "remove";
}): Promise<void> {
  const phone = normalizePhone(params.phone);
  if (!phone) return;

  if (params.action === "remove") {
    const existing = await getContactByPhone(params.tenantId, phone);
    if (!existing) return;
    const tags = [...new Set([...existing.tags, "wa_app_removed"])];
    await updateContact(params.tenantId, phone, { tags });
    return;
  }

  await upsertFromConversation({
    tenantId: params.tenantId,
    phoneNumber: phone,
    botId: params.botId,
    source: "sync",
    ...(params.displayName ? { displayName: params.displayName } : {}),
  });
}
