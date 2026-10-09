"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Mail,
  Plus,
  Save,
  Send,
  Trash2,
  Users,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

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

function statusVariant(status: string): "success" | "warning" | "info" | "default" {
  if (status === "sent") return "success";
  if (status === "sending") return "warning";
  if (status === "draft") return "info";
  return "default";
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-subtle pb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("block space-y-2 text-sm font-medium text-primary", className)}>
      <span>{label}</span>
      {children}
      {hint ? <span className="block text-xs font-normal text-muted">{hint}</span> : null}
    </div>
  );
}

export function MailrelayCampaignsTab({
  connected,
  onOpenTemplates,
}: {
  connected: boolean;
  onOpenTemplates?: () => void;
}) {
  const t = useT();
  const formRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const campaignsQuery = useMailrelayCampaigns(connected, { page, perPage: 20 });
  const configQuery = useMailrelayConfig(connected);
  const configDisabled = configQuery.data?.config.enabled === false;
  const provider = configQuery.data?.config.provider ?? "mailrelay";
  const isNrs360 = provider === "nrs360";
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
  const saving = createCampaign.isPending || updateCampaign.isPending;

  useEffect(() => {
    setError("");
    setSuccess("");
  }, [draft, testEmails]);

  useEffect(() => {
    if (!showForm) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showForm, editingId]);

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
  const senderLabel = configQuery.data?.config.fromName
    ? `${configQuery.data.config.fromName} <${configQuery.data.config.fromEmail || "-"}>`
    : configQuery.data?.config.fromEmail || t("mailrelay.audience.nrsSenderMissing");

  function closeForm() {
    setShowForm(false);
    setEditingId("");
    setDraft(emptyCampaign);
    setTestEmails("");
    setShowAdvanced(false);
    setError("");
    setSuccess("");
  }

  function openCreate() {
    const config = configQuery.data?.config;
    setDraft({
      ...emptyCampaign,
      senderId: isNrs360 ? "1" : config?.senderId ?? "",
      groupIds: config?.defaultGroupId ? [config.defaultGroupId] : [],
      target: "groups",
      replyTo: isNrs360 ? config?.replyTo || config?.fromEmail || "" : "",
    });
    setEditingId("");
    setTestEmails("");
    setShowAdvanced(false);
    setError("");
    setSuccess("");
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
    setError("");
    setSuccess("");
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
      subject: template.subject || template.name,
      previewText: template.previewText,
      html: template.html,
    }));
    if (!showForm) setShowForm(true);
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
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function validateDraft() {
    if (!draft.name.trim() || !draft.subject.trim() || !draft.html.trim()) {
      return t("mailrelay.validation.campaignRequired");
    }
    if (!isNrs360 && !draft.senderId) return t("mailrelay.validation.sender");
    if (isNrs360 && !configQuery.data?.config.fromEmail) {
      return t("mailrelay.validation.nrsSender");
    }
    if (!isNrs360 && draft.target === "segment") {
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
    const payload = isNrs360
      ? { ...draft, senderId: draft.senderId || "1", target: "groups" as const }
      : draft;
    try {
      if (editingId) {
        await updateCampaign.mutateAsync({ id: editingId, payload, provider });
      } else {
        const result = await createCampaign.mutateAsync({ payload, provider });
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
    if (!campaign) {
      setConfirmSendId("");
      return;
    }
    if (!isNrs360 && !campaign.senderId) {
      setError(t("mailrelay.validation.senderAudience"));
      setConfirmSendId("");
      return;
    }
    if (!isNrs360 && campaign.target === "segment" && !campaign.segmentId) {
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
      if (showForm) closeForm();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function handleDelete() {
    try {
      await deleteCampaign.mutateAsync(confirmDeleteId);
      if (editingId === confirmDeleteId) closeForm();
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

  if (showForm) {
    return (
      <div ref={formRef} className="space-y-4">
        <div className="-mx-1 border-b border-subtle px-1 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={closeForm}
                className="mb-1 inline-flex items-center gap-1.5 text-sm text-secondary transition-colors hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("mailrelay.campaigns.backToList")}
              </button>
              <h2 className="truncate text-lg font-semibold text-primary">
                {editingId
                  ? t("mailrelay.campaigns.editTitle")
                  : t("mailrelay.campaigns.createTitle")}
              </h2>
              <p className="text-sm text-secondary">
                {editingId
                  ? t("mailrelay.campaigns.formDescription")
                  : t("mailrelay.campaigns.unsavedHint")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {editingId ? (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDeleteId(editingId)}
                  disabled={deleteCampaign.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("mailrelay.actions.delete")}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={closeForm}>
                {t("mailrelay.actions.close")}
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? t("mailrelay.actions.saving") : t("mailrelay.actions.saveDraft")}
              </Button>
            </div>
          </div>
        </div>

        {error ? <Alert variant="danger">{error}</Alert> : null}
        {configDisabled ? (
          <Alert variant="warning">{t("mailrelay.audience.disabledHint")}</Alert>
        ) : null}
        {success ? <Alert variant="success">{success}</Alert> : null}

        <Section title={t("mailrelay.campaigns.sectionDetails")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("mailrelay.campaigns.name")} className="sm:col-span-2">
              <Input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                autoFocus
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
            {isNrs360 ? (
              <Field label={t("mailrelay.audience.sender")} className="sm:col-span-2">
                <p className="rounded-xl border border-default bg-surface-muted px-3 py-2.5 text-sm font-normal text-secondary">
                  {senderLabel}
                </p>
              </Field>
            ) : (
              <Field label={t("mailrelay.audience.sender")} className="sm:col-span-2">
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
            )}
          </div>

          <div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              onClick={() => setShowAdvanced((current) => !current)}
            >
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {showAdvanced
                ? t("mailrelay.campaigns.hideAdvanced")
                : t("mailrelay.campaigns.showAdvanced")}
            </button>
          </div>

          {showAdvanced ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {!isNrs360 ? (
                <Field label={t("mailrelay.campaigns.folder")}>
                  <Select
                    value={draft.campaignFolderId}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        campaignFolderId: event.target.value,
                      }))
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
              ) : null}
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
              {!isNrs360 ? (
                <>
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
                  <label className="flex items-center gap-2 self-end text-sm font-medium text-primary">
                    <input
                      type="checkbox"
                      checked={draft.usePremailer}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          usePremailer: event.target.checked,
                        }))
                      }
                    />
                    {t("mailrelay.campaigns.usePremailer")}
                  </label>
                </>
              ) : null}
            </div>
          ) : null}
        </Section>

        <Section
          title={t("mailrelay.campaigns.sectionAudience")}
          action={
            draft.target === "groups" || isNrs360 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary">
                <Users className="h-3.5 w-3.5" />
                {t("mailrelay.campaigns.selectedGroups", {
                  count: String(draft.groupIds.length),
                })}
              </span>
            ) : null
          }
        >
          {!isNrs360 ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["groups", t("mailrelay.campaigns.audienceGroups")],
                  ["segment", t("mailrelay.campaigns.audienceSegment")],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      target: value,
                      ...(value === "groups" ? { segmentId: "" } : { groupIds: [] }),
                    }))
                  }
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                    draft.target === value
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-default text-secondary hover:border-accent/40 hover:text-primary"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {draft.target === "groups" || isNrs360 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => {
                const selected = draft.groupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        groupIds: selected
                          ? current.groupIds.filter((id) => id !== group.id)
                          : [...current.groupIds, group.id],
                      }))
                    }
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-accent bg-accent-muted/40"
                        : "border-default hover:border-accent/40"
                    )}
                  >
                    <p className="text-sm font-semibold text-primary">{group.name}</p>
                    {group.subscriberCount != null ? (
                      <p className="mt-1 text-xs text-secondary">
                        {t("mailrelay.campaigns.groupContacts", {
                          count: String(group.subscriberCount),
                        })}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
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
                  <p className="text-xs font-normal text-muted">
                    {t("mailrelay.campaigns.segmentIdHint")}
                  </p>
                </div>
              )}
            </Field>
          )}
        </Section>

        <Section title={t("mailrelay.campaigns.sectionContent")}>
          <MailrelayTemplatesPanel
            connected={connected}
            onApply={applyTemplate}
            onOpenTemplates={onOpenTemplates}
          />
          <Field
            label={t("mailrelay.campaigns.html")}
            hint={
              isNrs360
                ? t("mailrelay.campaigns.htmlUnsubscribeNoteNrs")
                : t("mailrelay.campaigns.htmlUnsubscribeNote")
            }
          >
            <MailrelayHtmlEditor
              value={draft.html}
              onChange={(html) => setDraft((current) => ({ ...current, html }))}
              placeholder={t("mailrelay.campaigns.htmlPlaceholder")}
            />
          </Field>

          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-subtle bg-surface-muted px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("mailrelay.campaigns.inboxPreview")}
              </p>
            </div>
            <div className="space-y-3 border-b border-subtle px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-muted text-sm font-semibold text-accent">
                  {(draft.name || t("mailrelay.campaigns.create")).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-primary">
                    {draft.subject.trim() || t("mailrelay.campaigns.subject")}
                  </p>
                  <p className="truncate text-sm text-secondary">
                    {draft.name.trim() || t("mailrelay.campaigns.name")}
                  </p>
                  {draft.previewText.trim() ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{draft.previewText}</p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="bg-[linear-gradient(180deg,var(--surface-muted),transparent_40%)] p-4">
              <div className="overflow-hidden rounded-xl border border-subtle bg-white shadow-sm">
                {sanitizedHtml.trim() ? (
                  <div
                    className="rich-html-content emoji-text max-h-[28rem] overflow-auto p-5 text-sm text-gray-900"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                ) : (
                  <div className="flex min-h-56 items-center justify-center px-6 text-center text-sm text-muted">
                    {t("mailrelay.campaigns.previewEmpty")}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </Section>

        <Section title={t("mailrelay.campaigns.sectionTest")}>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-3">
              <label className="flex items-center gap-2 rounded-xl border border-default px-3 py-2.5 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={draft.trackOpens}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, trackOpens: event.target.checked }))
                  }
                />
                {t("mailrelay.campaigns.trackOpens")}
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-default px-3 py-2.5 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={draft.trackClicks}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, trackClicks: event.target.checked }))
                  }
                />
                {t("mailrelay.campaigns.trackClicks")}
              </label>
            </div>
            <div className="space-y-3">
              <Field
                label={t("mailrelay.campaigns.testEmails")}
                hint={
                  editingId
                    ? undefined
                    : t("mailrelay.campaigns.testHint")
                }
              >
                <Input
                  type="text"
                  value={testEmails}
                  onChange={(event) => setTestEmails(event.target.value)}
                  placeholder={t("mailrelay.campaigns.testEmailsPlaceholder")}
                />
              </Field>
              <Button
                variant="secondary"
                onClick={() => void handleTest()}
                disabled={sendTest.isPending || !editingId}
                className="w-full sm:w-auto"
              >
                <Send className="h-4 w-4" />
                {sendTest.isPending
                  ? t("mailrelay.actions.sending")
                  : t("mailrelay.actions.sendTest")}
              </Button>
            </div>
          </div>
        </Section>

        <div className="-mx-1 border-t border-subtle px-1 py-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={closeForm}>
              {t("mailrelay.actions.close")}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? t("mailrelay.actions.saving") : t("mailrelay.actions.saveDraft")}
            </Button>
            {editingId ? (
              <Button
                onClick={() => {
                  setConfirmSendId(editingId);
                  setSendScheduleMode("now");
                  setSendScheduledAt("");
                }}
              >
                <Send className="h-4 w-4" />
                {t("mailrelay.actions.sendAll")}
              </Button>
            ) : null}
          </div>
        </div>

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
                    name="send-schedule-form"
                    checked={sendScheduleMode === "now"}
                    onChange={() => setSendScheduleMode("now")}
                  />
                  {t("mailrelay.campaigns.sendNow")}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="send-schedule-form"
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-primary">{t("mailrelay.campaigns.listTitle")}</h2>
          <p className="mt-1 text-sm text-secondary">{t("mailrelay.campaigns.listDescription")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("mailrelay.campaigns.create")}
        </Button>
      </div>

      <SearchInput
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onClear={() => setSearch("")}
        placeholder={t("mailrelay.campaigns.searchPlaceholder")}
        className="max-w-md"
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}
      {configDisabled ? (
        <Alert variant="warning">{t("mailrelay.audience.disabledHint")}</Alert>
      ) : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {campaigns.length === 0 && !search.trim() ? (
        <Card padding="lg">
          <EmptyState
            icon={<Mail className="h-6 w-6" />}
            title={t("mailrelay.campaigns.empty")}
            description={t("mailrelay.campaigns.emptyDescription")}
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t("mailrelay.campaigns.create")}
              </Button>
            }
          />
        </Card>
      ) : filteredCampaigns.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title={t("mailrelay.campaigns.noResults")}
          description={t("mailrelay.campaigns.noResultsDescription")}
        />
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map((campaign) => {
            const isDraft = campaign.status === "draft";
            return (
              <Card
                key={campaign.id}
                padding="lg"
                className="transition-colors hover:border-accent/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => (isDraft ? openEdit(campaign) : undefined)}
                    disabled={!isDraft}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-primary">
                        {campaign.name}
                      </p>
                      <Badge variant={statusVariant(campaign.status)}>
                        {t(`mailrelay.campaignStatus.${campaign.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-secondary">{campaign.subject}</p>
                    {campaign.groupIds.length > 0 ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                        <Users className="h-3.5 w-3.5" />
                        {t("mailrelay.campaigns.selectedGroups", {
                          count: String(campaign.groupIds.length),
                        })}
                      </p>
                    ) : null}
                  </button>

                  {isDraft ? (
                    <div className="flex flex-wrap gap-1">
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
                        variant="secondary"
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
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => openDuplicate(campaign)}>
                      <Copy className="h-4 w-4" />
                      {t("mailrelay.actions.duplicate")}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}

          {pagination && (pagination.hasMore || page > 1) ? (
            <div className="flex items-center justify-between pt-2">
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
        </div>
      )}

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
