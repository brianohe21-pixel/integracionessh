import type { CampaignRecipient } from "@/hooks/useCampaigns";

const STORAGE_KEY = "integracionessh:campaign-recipient-draft";
const MAX_AGE_MS = 30 * 60 * 1000;

export interface CampaignRecipientDraft {
  recipients: CampaignRecipient[];
  source: "contacts";
  createdAt: number;
}

export function saveCampaignRecipientDraft(recipients: CampaignRecipient[]): void {
  if (typeof sessionStorage === "undefined") return;
  const draft: CampaignRecipientDraft = {
    recipients,
    source: "contacts",
    createdAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function consumeCampaignRecipientDraft(): CampaignRecipientDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    const draft = JSON.parse(raw) as CampaignRecipientDraft;
    if (Date.now() - draft.createdAt > MAX_AGE_MS) return null;
    if (!Array.isArray(draft.recipients) || draft.recipients.length === 0) return null;
    return draft;
  } catch {
    return null;
  }
}
