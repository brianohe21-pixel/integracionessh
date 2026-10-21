"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/i18n/context";

type CampaignEmailResultsModalProps = {
  open: boolean;
  defaultEmail?: string;
  isSending: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (emails: string[]) => Promise<void>;
};

function parseEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function CampaignEmailResultsModal({
  open,
  defaultEmail,
  isSending,
  error,
  onClose,
  onSubmit,
}: CampaignEmailResultsModalProps) {
  const t = useT();
  const [rawEmails, setRawEmails] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) return;
    setRawEmails(defaultEmail?.trim() ?? "");
    setLocalError("");
  }, [open, defaultEmail]);

  if (!open) return null;

  async function handleSubmit() {
    const emails = parseEmails(rawEmails);
    if (emails.length === 0) {
      setLocalError(t("campaigns.emailResultsRequired"));
      return;
    }
    if (emails.length > 20) {
      setLocalError(t("campaigns.emailResultsTooMany"));
      return;
    }
    if (emails.some((email) => !isValidEmail(email))) {
      setLocalError(t("campaigns.emailResultsInvalid"));
      return;
    }
    setLocalError("");
    try {
      await onSubmit(emails);
      onClose();
    } catch {
      // Parent keeps error message.
    }
  }

  return (
    <Modal>
      <div className="w-full max-w-md rounded-xl border border-default bg-surface-elevated p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-primary">{t("campaigns.emailResultsTitle")}</h3>
        <p className="mt-1 text-sm text-secondary">{t("campaigns.emailResultsHint")}</p>
        <label className="mt-4 block text-sm font-medium text-primary" htmlFor="campaign-email-results">
          {t("campaigns.emailResultsRecipients")}
        </label>
        <textarea
          id="campaign-email-results"
          value={rawEmails}
          onChange={(event) => setRawEmails(event.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
          placeholder={t("campaigns.emailResultsPlaceholder")}
          disabled={isSending}
        />
        {(localError || error) && (
          <p className="mt-2 text-sm text-red-600">{localError || error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="rounded-lg border border-default px-3 py-2 text-sm font-medium text-primary disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSending}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSending ? t("campaigns.emailingResults") : t("campaigns.emailResultsSend")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
