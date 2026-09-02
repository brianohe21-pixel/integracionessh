"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, Mail, MessageSquare, Phone, User } from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useAdvisors } from "@/hooks/useAdvisors";
import {
  useConvertLead,
  useLoseLead,
  useUpdateLead,
} from "@/hooks/useLeads";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";
import { useFormatters } from "@/hooks/useFormatters";
import type { Lead, LeadStatus } from "@/types";

function statusVariant(status: LeadStatus): "success" | "warning" | "danger" | "default" | "info" {
  if (status === "converted") return "success";
  if (status === "lost") return "danger";
  if (status === "qualified") return "info";
  if (status === "contacted") return "warning";
  return "default";
}

function leadInitials(name?: string, phone?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return phone?.slice(-2) ?? "?";
}

export function LeadDetailPanel({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const t = useT();
  const { formatDate } = useFormatters();
  const { data: bots } = useBots();
  const { data: advisors } = useAdvisors();
  const updateLead = useUpdateLead();
  const convertLead = useConvertLead();
  const loseLead = useLoseLead();
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [optInOnConvert, setOptInOnConvert] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const botName = bots?.find((b) => b.botId === lead.botId)?.name ?? lead.botId;
  const isClosed = lead.status === "converted" || lead.status === "lost";
  const initials = leadInitials(lead.name, lead.phone);
  const title = lead.name?.trim() || lead.phone;

  async function saveNotes() {
    setError("");
    setSaved(false);
    try {
      await updateLead.mutateAsync({ leadId: lead.leadId, notes });
      setSaved(true);
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
    <SideDrawer
      title={title}
      onClose={onClose}
      footer={
        !isClosed ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                checked={optInOnConvert}
                onChange={(e) => setOptInOnConvert(e.target.checked)}
                className="rounded border-default"
              />
              {t("leads.optInOnConvert")}
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="flex-1"
                onClick={handleConvert}
                disabled={convertLead.isPending}
              >
                {t("leads.convert")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleLose}
                disabled={loseLead.isPending}
              >
                {t("leads.markLost")}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6 p-5">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-muted text-lg font-semibold text-accent">
            {initials}
          </div>
          <p className="mt-3 font-mono text-sm text-secondary">{lead.phone}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <Badge variant={statusVariant(lead.status)}>
              {t(`leads.status_${lead.status}`)}
            </Badge>
            {lead.tags.map((tag) => (
              <Badge key={tag} variant="default">{tag}</Badge>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{formatDate(lead.createdAt)}</p>
        </div>

        <div className="rounded-xl border border-default bg-surface p-4 space-y-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {t("leads.sectionInfo")}
          </p>
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div>
              <p className="text-secondary">{t("common.phone")}</p>
              <p className="font-mono text-primary">{lead.phone}</p>
            </div>
          </div>
          {lead.name && (
            <div className="flex items-start gap-3">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div>
                <p className="text-secondary">{t("leads.colName")}</p>
                <p className="text-primary">{lead.name}</p>
              </div>
            </div>
          )}
          {lead.email && (
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div>
                <p className="text-secondary">{t("common.email")}</p>
                <p className="text-primary">{lead.email}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div>
              <p className="text-secondary">{t("leads.colBot")}</p>
              <p className="text-primary">{botName}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {t("leads.assignedAdvisor")}
          </p>
          <Select
            value={lead.assignedAdvisorId ?? ""}
            disabled={isClosed}
            onChange={(e) =>
              updateLead.mutate({
                leadId: lead.leadId,
                assignedAdvisorId: e.target.value || null,
              })
            }
          >
            <option value="">{t("leads.unassigned")}</option>
            {(advisors ?? []).map((a) => (
              <option key={a.advisorId} value={a.advisorId}>{a.name}</option>
            ))}
          </Select>
        </div>

        <div className="rounded-xl border border-default bg-surface p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            {t("leads.notes")}
          </p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isClosed}
            rows={4}
          />
          {!isClosed && (
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={saveNotes} disabled={updateLead.isPending}>
                {t("common.save")}
              </Button>
              {saved && <span className="text-xs text-success">{t("leads.saved")}</span>}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/conversations?botId=${lead.botId}&phone=${encodeURIComponent(lead.phone)}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            <MessageSquare className="h-4 w-4" />
            {t("leads.openConversation")}
          </Link>
          {lead.status === "converted" && (
            <Link
              href={`/contacts?q=${encodeURIComponent(lead.phone)}`}
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("leads.viewContact")}
            </Link>
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </SideDrawer>
  );
}
