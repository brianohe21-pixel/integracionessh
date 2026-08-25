"use client";

import { useState } from "react";
import { useT } from "@/i18n/context";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { X } from "lucide-react";
import type { OpportunityLossReason } from "@/types";

export function OpportunityCloseDialog({
  outcome,
  onClose,
  onConfirm,
}: {
  outcome: "won" | "lost";
  onClose: () => void;
  onConfirm: (data: { closeReason?: string; lossReason?: OpportunityLossReason }) => Promise<void>;
}) {
  const t = useT();
  const [closeReason, setCloseReason] = useState("");
  const [lossReason, setLossReason] = useState<OpportunityLossReason | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (outcome === "lost" && !lossReason) {
      setError(t("sales.lossReasonRequired"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onConfirm({
        ...(closeReason.trim() ? { closeReason: closeReason.trim() } : {}),
        ...(lossReason ? { lossReason } : {}),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal>
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-surface-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-default px-6 py-4">
          <h2 className="text-lg font-semibold text-primary">
            {outcome === "won" ? t("sales.closeWonTitle") : t("sales.closeLostTitle")}
          </h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {outcome === "lost" ? (
            <Select
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value as OpportunityLossReason)}
            >
              <option value="">{t("sales.selectLossReason")}</option>
              <option value="price">{t("sales.lossReason_price")}</option>
              <option value="competition">{t("sales.lossReason_competition")}</option>
              <option value="no_response">{t("sales.lossReason_no_response")}</option>
              <option value="timing">{t("sales.lossReason_timing")}</option>
              <option value="not_qualified">{t("sales.lossReason_not_qualified")}</option>
              <option value="other">{t("sales.lossReason_other")}</option>
            </Select>
          ) : null}
          <Textarea
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            placeholder={t("sales.closeReasonPlaceholder")}
            className="min-h-[80px]"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={loading}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
