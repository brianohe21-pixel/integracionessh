"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Trash2, X } from "lucide-react";
import { useT } from "@/i18n/context";
import { usePaymentsConfig } from "@/hooks/usePayments";
import { useCreateQuotation } from "@/hooks/useQuotations";
import { Button } from "@/components/ui/Button";
import type { Conversation } from "@/types";

type LineDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPriceCop: string;
};

type Props = {
  conversation: Conversation;
  open: boolean;
  onClose: () => void;
};

function newLine(): LineDraft {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unitPriceCop: "",
  };
}

function formatCop(cents: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function QuotationDrawer({ conversation, open, onClose }: Props) {
  const t = useT();
  const botId = conversation.botId;
  const { data: paymentsData } = usePaymentsConfig(botId);
  const create = useCreateQuotation(conversation.conversationId);
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState("");

  const paymentsReady =
    paymentsData?.config.enabled === true && paymentsData.wompiConfigured === true;

  const previewTotalCents = useMemo(() => {
    return lines.reduce((sum, line) => {
      const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
      const unitCents = Math.round((parseFloat(line.unitPriceCop) || 0) * 100);
      return sum + qty * unitCents;
    }, 0);
  }, [lines]);

  function updateLine(id: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function removeLine(id: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.id !== id)));
  }

  function resetForm() {
    setLines([newLine()]);
    setNotes("");
    setValidUntil("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const items = lines
      .map((line) => ({
        description: line.description.trim(),
        quantity: Math.max(1, parseInt(line.quantity, 10) || 1),
        unitPriceInCents: Math.round((parseFloat(line.unitPriceCop) || 0) * 100),
      }))
      .filter((item) => item.description.length > 0);

    if (items.length === 0) {
      setError(t("quotations.errorNoItems"));
      return;
    }

    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPriceInCents, 0);
    if (total < 1000) {
      setError(t("quotations.errorMinAmount"));
      return;
    }

    try {
      await create.mutateAsync({
        botId,
        items,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(validUntil ? { validUntil: new Date(validUntil).toISOString() } : {}),
      });
      resetForm();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-xl border border-default bg-surface-elevated shadow-xl sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-default px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-primary">{t("quotations.drawerTitle")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {!paymentsReady ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p>{t("quotations.paymentsRequired")}</p>
                <Link
                  href={`/apps/payments/${botId}`}
                  className="mt-2 inline-block font-medium text-accent hover:underline"
                >
                  {t("quotations.configurePayments")}
                </Link>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-primary">{t("quotations.itemsTitle")}</h3>
                <button
                  type="button"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                  className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  {t("quotations.addItem")}
                </button>
              </div>

              {lines.map((line) => (
                <div key={line.id} className="grid gap-2 rounded-lg border border-default p-3">
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(line.id, { description: e.target.value })}
                    placeholder={t("quotations.itemDescription")}
                    className="rounded-lg border border-default px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                      placeholder={t("quotations.itemQuantity")}
                      className="rounded-lg border border-default px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unitPriceCop}
                      onChange={(e) => updateLine(line.id, { unitPriceCop: e.target.value })}
                      placeholder={t("quotations.itemUnitPrice")}
                      className="rounded-lg border border-default px-3 py-2 text-sm"
                    />
                  </div>
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("common.delete")}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="grid gap-3">
              <label className="text-sm text-secondary">
                {t("quotations.notes")}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-default px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-secondary">
                {t("quotations.validUntil")}
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-default px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm">
              <span className="text-secondary">{t("quotations.totalPreview")}: </span>
              <span className="font-semibold text-primary">{formatCop(previewTotalCents)}</span>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-default p-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!paymentsReady || create.isPending}>
              {t("quotations.send")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
