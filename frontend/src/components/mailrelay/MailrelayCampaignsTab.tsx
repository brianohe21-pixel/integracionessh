"use client";

import { useEffect, useMemo, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { Edit3, Mail, Plus, Send, Trash2 } from "lucide-react";
import {
  useCreateMailrelayCampaign,
  useDeleteMailrelayCampaign,
  useMailrelayConfig,
  useMailrelayCampaigns,
  useMailrelayGroups,
  useMailrelaySenders,
  useSendMailrelayCampaign,
  useSendMailrelayTest,
  useUpdateMailrelayCampaign,
} from "@/hooks/useMailrelay";
import { useT } from "@/i18n/context";
import type { MailrelayCampaign, MailrelayCampaignInput } from "@/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { MailrelayHtmlEditor } from "./MailrelayHtmlEditor";
import { Skeleton } from "@/components/ui/Skeleton";

const emptyCampaign: MailrelayCampaignInput = {
  name: "",
  subject: "",
  previewText: "",
  html: "",
  senderId: "",
  groupIds: [],
  trackOpens: true,
  trackClicks: true,
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MailrelayCampaignsTab({ connected }: { connected: boolean }) {
  const t = useT();
  const campaignsQuery = useMailrelayCampaigns(connected);
  const configQuery = useMailrelayConfig(connected);
  const groupsQuery = useMailrelayGroups(connected);
  const sendersQuery = useMailrelaySenders(connected);
  const createCampaign = useCreateMailrelayCampaign();
  const updateCampaign = useUpdateMailrelayCampaign();
  const deleteCampaign = useDeleteMailrelayCampaign();
  const sendTest = useSendMailrelayTest();
  const sendCampaign = useSendMailrelayCampaign();
  const [draft, setDraft] = useState<MailrelayCampaignInput>(emptyCampaign);
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [testEmails, setTestEmails] = useState("");
  const [confirmSendId, setConfirmSendId] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sanitizedHtml = useMemo(
    () => DOMPurify.sanitize(draft.html, { USE_PROFILES: { html: true } }),
    [draft.html]
  );

  useEffect(() => {
    setError("");
    setSuccess("");
  }, [draft, testEmails]);

  if (!connected) {
    return (
      <EmptyState
        icon={<Mail className="h-6 w-6" />}
        title={t("mailrelay.states.connectionRequired")}
        description={t("mailrelay.states.connectionRequiredDescription")}
      />
    );
  }

  const campaigns = campaignsQuery.data?.campaigns ?? [];
  const groups = groupsQuery.data?.groups ?? [];
  const senders = sendersQuery.data?.senders ?? [];
  const queryError =
    campaignsQuery.error ?? configQuery.error ?? groupsQuery.error ?? sendersQuery.error;

  function openCreate() {
    const config = configQuery.data?.config;
    setDraft({
      ...emptyCampaign,
      senderId: config?.senderId ?? "",
      groupIds: config?.defaultGroupId ? [config.defaultGroupId] : [],
    });
    setEditingId("");
    setTestEmails("");
    setShowForm(true);
  }

  function openEdit(campaign: MailrelayCampaign) {
    setDraft({
      name: campaign.name,
      subject: campaign.subject,
      previewText: campaign.previewText,
      html: campaign.html,
      senderId: campaign.senderId,
      groupIds: campaign.groupIds,
      trackOpens: campaign.trackOpens,
      trackClicks: campaign.trackClicks,
    });
    setEditingId(campaign.id);
    setTestEmails("");
    setShowForm(true);
  }

  function validateDraft() {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.html.trim()) {
      return t("mailrelay.validation.campaignRequired");
    }
    if (!draft.senderId) return t("mailrelay.validation.sender");
    if (draft.groupIds.length === 0) return t("mailrelay.validation.audience");
    return "";
  }

  async function handleSave() {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      if (editingId) {
        await updateCampaign.mutateAsync({ id: editingId, payload: draft });
      } else {
        const result = await createCampaign.mutateAsync(draft);
        setEditingId(result.campaign.id);
      }
      setSuccess(t("mailrelay.campaigns.saved"));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleTest() {
    const validationError = validateDraft();
    const emails = testEmails
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!editingId) {
      setError(t("mailrelay.validation.saveBeforeTest"));
      return;
    }
    if (emails.length === 0 || emails.some((email) => !emailPattern.test(email))) {
      setError(t("mailrelay.validation.emails"));
      return;
    }
    try {
      await sendTest.mutateAsync({ id: editingId, emails });
      setSuccess(t("mailrelay.campaigns.testSent"));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleSend() {
    const campaign = campaigns.find((item) => item.id === confirmSendId);
    if (!campaign?.senderId || campaign.groupIds.length === 0) {
      setError(t("mailrelay.validation.senderAudience"));
      setConfirmSendId("");
      return;
    }
    try {
      await sendCampaign.mutateAsync(campaign);
      setConfirmSendId("");
      setSuccess(t("mailrelay.campaigns.sending"));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleDelete() {
    try {
      await deleteCampaign.mutateAsync(confirmDeleteId);
      if (editingId === confirmDeleteId) {
        setShowForm(false);
        setEditingId("");
      }
      setConfirmDeleteId("");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  if (
    campaignsQuery.isLoading ||
    configQuery.isLoading ||
    groupsQuery.isLoading ||
    sendersQuery.isLoading
  ) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (queryError) {
    return <Alert variant="danger">{queryError.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("mailrelay.campaigns.create")}
        </Button>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {showForm ? (
        <Card padding="lg" className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-primary">
                {editingId
                  ? t("mailrelay.campaigns.editTitle")
                  : t("mailrelay.campaigns.createTitle")}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {t("mailrelay.campaigns.formDescription")}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              {t("mailrelay.actions.close")}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("mailrelay.campaigns.name")}>
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </Field>
            <Field label={t("mailrelay.campaigns.subject")}>
              <Input
                value={draft.subject}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, subject: event.target.value }))
                }
              />
            </Field>
            <Field label={t("mailrelay.campaigns.previewText")}>
              <Input
                value={draft.previewText}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, previewText: event.target.value }))
                }
              />
            </Field>
            <Field label={t("mailrelay.audience.sender")}>
              <Select
                value={draft.senderId}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, senderId: event.target.value }))
                }
              >
                <option value="">{t("mailrelay.audience.selectSender")}</option>
                {senders.map((sender) => (
                  <option key={sender.id} value={sender.id}>
                    {sender.name} ({sender.email})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label={t("mailrelay.campaigns.audience")}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className="flex items-center gap-2 rounded-lg border border-default p-3 text-sm text-primary"
                >
                  <input
                    type="checkbox"
                    checked={draft.groupIds.includes(group.id)}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        groupIds: event.target.checked
                          ? [...current.groupIds, group.id]
                          : current.groupIds.filter((id) => id !== group.id),
                      }))
                    }
                  />
                  <span>
                    {group.name}
                    {group.subscriberCount != null ? ` (${group.subscriberCount})` : ""}
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <Field label={t("mailrelay.campaigns.html")}>
            <MailrelayHtmlEditor
              value={draft.html}
              onChange={(html) => setDraft((current) => ({ ...current, html }))}
              placeholder={t("mailrelay.campaigns.htmlPlaceholder")}
            />
            <p className="text-xs text-muted">{t("mailrelay.campaigns.htmlUnsubscribeNote")}</p>
          </Field>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-primary">
                {t("mailrelay.campaigns.preview")}
              </p>
              <div
                className="min-h-40 overflow-auto rounded-lg border border-default bg-white p-4 text-gray-900"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={draft.trackOpens}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, trackOpens: event.target.checked }))
                  }
                />
                {t("mailrelay.campaigns.trackOpens")}
              </label>
              <label className="flex items-center gap-2 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={draft.trackClicks}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, trackClicks: event.target.checked }))
                  }
                />
                {t("mailrelay.campaigns.trackClicks")}
              </label>
              <Field label={t("mailrelay.campaigns.testEmails")}>
                <Input
                  type="text"
                  value={testEmails}
                  onChange={(event) => setTestEmails(event.target.value)}
                  placeholder={t("mailrelay.campaigns.testEmailsPlaceholder")}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => void handleSave()}
              disabled={createCampaign.isPending || updateCampaign.isPending}
            >
              {t("mailrelay.actions.saveDraft")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleTest()}
              disabled={sendTest.isPending}
            >
              <Send className="h-4 w-4" />
              {t("mailrelay.actions.sendTest")}
            </Button>
          </div>
        </Card>
      ) : null}

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title={t("mailrelay.campaigns.empty")}
          description={t("mailrelay.campaigns.emptyDescription")}
          action={<Button onClick={openCreate}>{t("mailrelay.campaigns.create")}</Button>}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">{t("mailrelay.campaigns.name")}</th>
                  <th className="px-4 py-3">{t("mailrelay.campaigns.subject")}</th>
                  <th className="px-4 py-3">{t("mailrelay.campaigns.status")}</th>
                  <th className="px-4 py-3 text-right">{t("mailrelay.campaigns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="px-4 py-3 font-medium text-primary">{campaign.name}</td>
                    <td className="px-4 py-3 text-secondary">{campaign.subject}</td>
                    <td className="px-4 py-3">
                      <Badge variant={campaign.status === "sent" ? "success" : "default"}>
                        {t(`mailrelay.campaignStatus.${campaign.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {campaign.status === "draft" ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEdit(campaign)}>
                              <Edit3 className="h-4 w-4" />
                              {t("mailrelay.actions.edit")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmSendId(campaign.id)}
                            >
                              <Send className="h-4 w-4" />
                              {t("mailrelay.actions.sendAll")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmDeleteId(campaign.id)}
                              aria-label={t("mailrelay.actions.delete")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(confirmSendId)}
        title={t("mailrelay.campaigns.sendTitle")}
        description={t("mailrelay.campaigns.sendDescription")}
        confirmLabel={t("mailrelay.actions.sendAll")}
        tone="warning"
        loading={sendCampaign.isPending}
        onCancel={() => setConfirmSendId("")}
        onConfirm={() => void handleSend()}
      />
      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title={t("mailrelay.campaigns.deleteTitle")}
        description={t("mailrelay.campaigns.deleteDescription")}
        confirmLabel={t("mailrelay.actions.delete")}
        tone="danger"
        loading={deleteCampaign.isPending}
        onCancel={() => setConfirmDeleteId("")}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block space-y-2 text-sm font-medium text-primary">
      <span>{label}</span>
      {children}
    </div>
  );
}
