"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useAdvisors } from "@/hooks/useAdvisors";
import {
  useConvertLead,
  useLoseLead,
  useUpdateLead,
} from "@/hooks/useLeads";
import { Badge } from "@/components/ui/Badge";
import type { Lead, LeadStatus } from "@/types";

function statusVariant(status: LeadStatus): "success" | "warning" | "danger" | "default" | "info" {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  if (status === "qualified") return "info";
  if (status === "contacted") return "warning";
  return "default";
}

export function LeadDetailPanel({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const t = useT();
  const { data: bots } = useBots();
  const { data: advisors } = useAdvisors();
  const updateLead = useUpdateLead();
  const convertLead = useConvertLead();
  const loseLead = useLoseLead();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [optInOnConvert, setOptInOnConvert] = useState(false);
  const [error, setError] = useState("");

  const botName = bots?.find((b) => b.botId === lead.botId)?.name ?? lead.botId;
  const isClosed = lead.status === "converted" || lead.status === "lost";

  async function saveNotes() {
    setError("");
    try {
      await updateLead.mutateAsync({ leadId: lead.leadId, notes });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleConvert() {
    setError("");
    try {
      await convertLead.mutateAsync({
        leadId: lead.leadId,
        ...(optInOnConvert ? { marketingConsent: "opt_in" } : {}),
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleLose() {
    setError("");
    try {
      await loseLead.mutateAsync(lead.leadId);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="w-full max-w-md bg-white h-full shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">{t("leads.detailTitle")}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(lead.status)}>{t(`leads.status_${lead.status}`)}</Badge>
            <span className="text-gray-500">{new Date(lead.createdAt).toLocaleString()}</span>
          </div>

          <div className="space-y-2">
            <p><span className="text-gray-500">{t("common.phone")}:</span> {lead.phone}</p>
            {lead.name && <p><span className="text-gray-500">{t("leads.colName")}:</span> {lead.name}</p>}
            {lead.email && <p><span className="text-gray-500">{t("common.email")}:</span> {lead.email}</p>}
            <p><span className="text-gray-500">{t("leads.colBot")}:</span> {botName}</p>
            {lead.tags.length > 0 && (
              <p className="flex flex-wrap gap-1 items-center">
                <span className="text-gray-500">{t("contacts.colTags")}:</span>
                {lead.tags.map((tag) => (
                  <Badge key={tag} variant="default">{tag}</Badge>
                ))}
              </p>
            )}
          </div>

          <div>
            <label className="block text-gray-500 mb-1">{t("leads.assignedAdvisor")}</label>
            <select
              value={lead.assignedAdvisorId ?? ""}
              disabled={isClosed}
              onChange={(e) =>
                updateLead.mutate({
                  leadId: lead.leadId,
                  assignedAdvisorId: e.target.value || null,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">{t("leads.unassigned")}</option>
              {(advisors ?? []).map((a) => (
                <option key={a.advisorId} value={a.advisorId}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-500 mb-1">{t("leads.notes")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isClosed}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            {!isClosed && (
              <button
                type="button"
                onClick={saveNotes}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
              >
                {t("common.save")}
              </button>
            )}
          </div>

          <Link
            href={`/conversations?botId=${lead.botId}&phone=${encodeURIComponent(lead.phone)}`}
            className="inline-block text-indigo-600 hover:text-indigo-800"
          >
            {t("leads.openConversation")}
          </Link>

          {lead.status === "converted" && (
            <Link
              href={`/contacts?q=${encodeURIComponent(lead.phone)}`}
              className="inline-block text-indigo-600 hover:text-indigo-800 ml-4"
            >
              {t("leads.viewContact")}
            </Link>
          )}

          {error && <p className="text-red-600">{error}</p>}
        </div>

        {!isClosed && (
          <div className="border-t border-gray-200 p-5 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={optInOnConvert}
                onChange={(e) => setOptInOnConvert(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t("leads.optInOnConvert")}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConvert}
                disabled={convertLead.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                {t("leads.convert")}
              </button>
              <button
                type="button"
                onClick={handleLose}
                disabled={loseLead.isPending}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t("leads.markLost")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
