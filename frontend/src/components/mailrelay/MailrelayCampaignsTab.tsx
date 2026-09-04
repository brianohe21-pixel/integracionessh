"use client";

import { useEffect, useMemo, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { Copy, Edit3, Mail, Plus, Send, Trash2 } from "lucide-react";
import {
  useCreateMailrelayCampaign,
  useDeleteMailrelayCampaign,
  useMailrelayCampaignFolders,
  useMailrelayConfig,
  useMailrelayCampaigns,
  useMailrelayGroups,
  useMailrelaySegments,
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
import { MailrelayTemplatesPanel } from "./MailrelayTemplatesPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { SearchInput } from "@/components/ui/SearchInput";

const emptyCampaign: MailrelayCampaignInput = {
  name: "",
  subject: "",
  previewText: "",
  html: "",
  senderId: "",
  target: "groups",
  groupIds: [],
  segmentId: "",
  campaignFolderId: "",
  replyTo: "",
  analyticsUtmCampaign: "",
  usePremailer: false,
  trackOpens: true,
  trackClicks: true,
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MailrelayCampaignsTab({ connected }: { connected: boolean }) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const campaignsQuery = useMailrelayCampaigns(connected, { page, perPage: 20 });
  const configQuery = useMailrelayConfig(connected);
  const configDisabled = configQuery.data?.config.enabled === false;
  const groupsQuery = useMailrelayGroups(connected);
  const segmentsQuery = useMailrelaySegments(connected);
  const foldersQuery = useMailrelayCampaignFolders(connected);
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
  const [sendScheduleMode, setSendScheduleMode] = useState<"now" | "scheduled">("now");
  const [sendScheduledAt, setSendScheduledAt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  const campaigns = useMemo(
    () => campaignsQuery.data?.campaigns ?? [],
    [campaignsQuery.data?.campaigns]
  );
  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return campaigns;
    return campaigns.filter(
      (campaign) =>
        campaign.name.toLowerCase().includes(query) ||
        campaign.subject.toLowerCase().includes(query)
    );
  }, [campaigns, search]);

  if (!connected) {
    return (
      <EmptyState
        icon={<Mail className="h-6 w-6" />}
        title={t("mailrelay.states.connectionRequired")}
        description={t("mailrelay.states.connectionRequiredDescription")}
      />
    );
  }

  const pagination = campaignsQuery.data?.pagination;
  const groups = groupsQuery.data?.groups ?? [];
  const segments = segmentsQuery.data?.segments ?? [];
  const folders = foldersQuery.data?.folders ?? [];
  const senders = sendersQuery.data?.senders ?? [];
  const queryError =
    campaignsQuery.error ??
    configQuery.error ??
    groupsQuery.error ??
    foldersQuery.error ??
    sendersQuery.error;

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

  function openDuplicate(campaign: MailrelayCampaign) {
    setDraft({
      name: `${campaign.name} (${t("mailrelay.campaigns.copySuffix")})`,
      subject: campaign.subject,
      previewText: campaign.previewText,
      html: campaign.html,
      senderId: campaign.senderId,
      target: campaign.target,
      groupIds: campaign.groupIds,
      segmentId: campaign.segmentId,
      campaignFolderId: campaign.campaignFolderId,
      replyTo: campaign.replyTo,
      analyticsUtmCampaign: campaign.analyticsUtmCampaign,
      usePremailer: campaign.usePremailer,
      trackOpens: campaign.trackOpens,
      trackClicks: campaign.trackClicks,
    });
    setEditingId("");
    setTestEmails("");
    setShowAdvanced(
      Boolean(
        campaign.campaignFolderId ||
          campaign.replyTo ||
          campaign.analyticsUtmCampaign ||
          campaign.usePremailer
      )
    );
    setShowForm(true);
  }

  function applyTemplate(template: {
    name: string;
    subject: string;
    previewText: string;
    html: string;
  }) {
    setDraft((current) => ({
      ...current,
      name: current.name || template.name,
      subject: template.subject,
      previewText: template.previewText,
      html: template.html,
    }));
    setShowForm(true);
  }

  function openEdit(campaign: MailrelayCampaign) {
    setDraft({
      name: campaign.name,
      subject: campaign.subject,
      previewText: campaign.previewText,
      html: campaign.html,
      senderId: campaign.senderId,
      target: campaign.target,
      groupIds: campaign.groupIds,
      segmentId: campaign.segmentId,
      campaignFolderId: campaign.campaignFolderId,
      replyTo: campaign.replyTo,
      analyticsUtmCampaign: campaign.analyticsUtmCampaign,
      usePremailer: campaign.usePremailer,
      trackOpens: campaign.trackOpens,
      trackClicks: campaign.trackClicks,
    });
    setEditingId(campaign.id);
    setTestEmails("");
    setShowAdvanced(
      Boolean(
        campaign.campaignFolderId ||
          campaign.replyTo ||
          campaign.analyticsUtmCampaign ||
          campaign.usePremailer
      )
    );
    setShowForm(true);
  }

  function validateDraft() {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.html.trim()) {
      return t("mailrelay.validation.campaignRequired");
    }
    if (!draft.senderId) return t("mailrelay.validation.sender");
    if (draft.target === "segment") {
      if (!draft.segmentId) return t("mailrelay.validation.segment");
    } else if (draft.groupIds.length === 0) {
      return t("mailrelay.validation.audience");
    }
    if (draft.replyTo && !emailPattern.test(draft.replyTo)) {
      return t("mailrelay.validation.replyTo");
    }
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
    if (!campaign?.senderId) {
      setError(t("mailrelay.validation.senderAudience"));
      setConfirmSendId("");
      return;
    }
    if (campaign.target === "segment" && !campaign.segmentId) {
      setError(t("mailrelay.validation.segment"));
      setConfirmSendId("");
      return;
    }
    if (campaign.target !== "segment" && campaign.groupIds.length === 0) {
      setError(t("mailrelay.validation.senderAudience"));
      setConfirmSendId("");
      return;
    }
    if (sendScheduleMode === "scheduled" && !sendScheduledAt) {
      setError(t("mailrelay.validation.schedule"));
      return;
    }
    try {
      const scheduledAt =
        sendScheduleMode === "scheduled" ? new Date(sendScheduledAt).toISOString() : undefined;
      await sendCampaign.mutateAsync({ campaign, scheduledAt });
      setConfirmSendId("");
      setSendScheduleMode("now");
      setSendScheduledAt("");
      setSuccess(
        sendScheduleMode === "scheduled"
          ? t("mailrelay.campaigns.scheduled")
          : t("mailrelay.campaigns.sending")
      );
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
    foldersQuery.isLoading ||
    sendersQuery.isLoading
  ) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (queryError) {
    return <Alert variant="danger">{queryError.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          placeholder={t("mailrelay.campaigns.searchPlaceholder")}
          className="max-w-md"
        />
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("mailrelay.campaigns.create")}
        </Button>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {configDisabled ? (
        <Alert variant="warning">{t("mailrelay.audience.disabledHint")}</Alert>
      ) : null}
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

          <Field label={t("mailrelay.campaigns.audienceType")}>
            <div className="flex flex-wrap gap-4 text-sm text-primary">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audience-type"
                  checked={draft.target === "groups"}
                  onChange={() =>
                    setDraft((current) => ({ ...current, target: "groups", segmentId: "" }))
                  }
                />
                {t("mailrelay.campaigns.audienceGroups")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="audience-type"
                  checked={draft.target === "segment"}
                  onChange={() =>
                    setDraft((current) => ({ ...current, target: "segment", groupIds: [] }))
                  }
                />
                {t("mailrelay.campaigns.audienceSegment")}
              </label>
            </div>
          </Field>

          {draft.target === "groups" ? (
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
          ) : (
            <Field label={t("mailrelay.campaigns.segment")}>
              {segments.length > 0 ? (
                <Select
                  value={draft.segmentId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, segmentId: event.target.value }))
                  }
                >
                  <option value="">{t("mailrelay.campaigns.selectSegment")}</option>
                  {segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={draft.segmentId}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, segmentId: event.target.value }))
                    }
                    placeholder={t("mailrelay.campaigns.segmentIdPlaceholder")}
                  />
                  <p className="text-xs text-muted">{t("mailrelay.campaigns.segmentIdHint")}</p>
                </div>
              )}
            </Field>
          )}

          <div>
            <button
              type="button"
              className="text-sm font-medium text-accent hover:underline"
              onClick={() => setShowAdvanced((current) => !current)}
            >
              {showAdvanced
                ? t("mailrelay.campaigns.hideAdvanced")
                : t("mailrelay.campaigns.showAdvanced")}
            </button>
          </div>

          {showAdvanced ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("mailrelay.campaigns.folder")}>
                <Select
                  value={draft.campaignFolderId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, campaignFolderId: event.target.value }))
                  }
                >
                  <option value="">{t("mailrelay.campaigns.noFolder")}</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("mailrelay.campaigns.replyTo")}>
                <Input
                  type="email"
                  value={draft.replyTo}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, replyTo: event.target.value }))
                  }
                  placeholder={t("mailrelay.campaigns.replyToPlaceholder")}
                />
              </Field>
              <Field label={t("mailrelay.campaigns.utmCampaign")}>
                <Input
                  value={draft.analyticsUtmCampaign}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      analyticsUtmCampaign: event.target.value,
                    }))
                  }
                  placeholder={t("mailrelay.campaigns.utmCampaignPlaceholder")}
                />
              </Field>
              <label className="flex items-center gap-2 self-end text-sm text-primary">
                <input
                  type="checkbox"
                  checked={draft.usePremailer}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, usePremailer: event.target.checked }))
                  }
                />
                {t("mailrelay.campaigns.usePremailer")}
              </label>
            </div>
          ) : null}

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
                className="emoji-text min-h-40 overflow-auto rounded-lg border border-default bg-white p-4 text-gray-900"
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

      {campaigns.length === 0 && !search.trim() ? (
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title={t("mailrelay.campaigns.empty")}
          description={t("mailrelay.campaigns.emptyDescription")}
          action={<Button onClick={openCreate}>{t("mailrelay.campaigns.create")}</Button>}
        />
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title={t("mailrelay.campaigns.noResults")}
          description={t("mailrelay.campaigns.noResultsDescription")}
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
                {filteredCampaigns.map((campaign) => (
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
                            <Button size="sm" variant="ghost" onClick={() => openDuplicate(campaign)}>
                              <Copy className="h-4 w-4" />
                              {t("mailrelay.actions.duplicate")}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setConfirmSendId(campaign.id);
                                setSendScheduleMode("now");
                                setSendScheduledAt("");
                              }}
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
          {pagination && (pagination.hasMore || page > 1) ? (
            <div className="flex items-center justify-between border-t border-default px-4 py-3">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t("mailrelay.campaigns.previousPage")}
              </Button>
              <span className="text-sm text-secondary">
                {t("mailrelay.campaigns.page", { page: String(page) })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!pagination.hasMore}
                onClick={() => setPage((current) => current + 1)}
              >
                {t("mailrelay.campaigns.nextPage")}
              </Button>
            </div>
          ) : null}
        </Card>
      )}

      <MailrelayTemplatesPanel connected={connected} draft={draft} onApply={applyTemplate} />

      <ConfirmDialog
        open={Boolean(confirmSendId)}
        title={t("mailrelay.campaigns.sendTitle")}
        description={
          <div className="space-y-3">
            <p>{t("mailrelay.campaigns.sendDescription")}</p>
            <div className="flex flex-wrap gap-4 text-sm text-primary">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="send-schedule"
                  checked={sendScheduleMode === "now"}
                  onChange={() => setSendScheduleMode("now")}
                />
                {t("mailrelay.campaigns.sendNow")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="send-schedule"
                  checked={sendScheduleMode === "scheduled"}
                  onChange={() => setSendScheduleMode("scheduled")}
                />
                {t("mailrelay.campaigns.sendScheduled")}
              </label>
            </div>
            {sendScheduleMode === "scheduled" ? (
              <Input
                type="datetime-local"
                value={sendScheduledAt}
                onChange={(event) => setSendScheduledAt(event.target.value)}
              />
            ) : null}
          </div>
        }
        confirmLabel={
          sendScheduleMode === "scheduled"
            ? t("mailrelay.actions.scheduleSend")
            : t("mailrelay.actions.sendAll")
        }
        tone="warning"
        loading={sendCampaign.isPending}
        onCancel={() => {
          setConfirmSendId("");
          setSendScheduleMode("now");
          setSendScheduledAt("");
        }}
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
