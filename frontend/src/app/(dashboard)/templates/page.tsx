"use client";

import { useMemo, useState } from "react";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useSendTemplate,
} from "@/hooks/useTemplates";
import { useBots } from "@/hooks/useBots";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { MessageTemplate, OutreachChannel } from "@/types";
import { isSmsTemplate } from "@/types";
import { OutreachChannelSelect } from "@/components/outreach/OutreachChannelSelect";
import { SmsTemplatePreview } from "@/components/templates/SmsTemplatePreview";
import { TemplateChannelForm } from "@/components/templates/channel/TemplateChannelForm";
import {
  buildWhatsAppComponents,
  EMPTY_SMS_FORM,
  EMPTY_WHATSAPP_FORM,
  isWhatsAppFormValid,
  whatsAppFormFromComponents,
} from "@/components/templates/channel/types";
import { extractBodyVariables } from "@/lib/templates/variables";
import {
  LayoutTemplate,
  Plus,
  Send,
  Pencil,
  Trash2,
  X,
  Languages,
  Tag,
  Clock,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";
import { ContextualHint } from "@/components/help-center/ContextualHint";
import { TourPageSuggestion } from "@/components/help-center/TourList";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";

type DialogMode = "create" | "edit" | null;

export default function TemplatesPage() {
  const t = useT();
  const { formatDate } = useFormatters();

  const STATUS_BADGE = useMemo(
    () => ({
      APPROVED: { label: t("templates.statusApproved"), variant: "success" as const },
      PENDING: { label: t("templates.statusPending"), variant: "warning" as const },
      REJECTED: { label: t("templates.statusRejected"), variant: "danger" as const },
    }),
    [t]
  );

  const CATEGORY_LABELS = useMemo(
    () => ({
      MARKETING: t("templates.categoryMarketing"),
      UTILITY: t("templates.categoryUtility"),
      AUTHENTICATION: t("templates.categoryAuth"),
    }),
    [t]
  );

  const LANGUAGES = useMemo(
    () => [
      { code: "es", label: t("templates.langEs") },
      { code: "en", label: t("templates.langEn") },
      { code: "en_US", label: t("templates.langEnUs") },
      { code: "es_AR", label: t("templates.langEsAr") },
      { code: "es_MX", label: t("templates.langEsMx") },
      { code: "pt_BR", label: t("templates.langPtBr") },
    ],
    [t]
  );

  const [botFilter, setBotFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<OutreachChannel>("whatsapp");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [sendTarget, setSendTarget] = useState<MessageTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MessageTemplate | null>(null);

  const { data: bots } = useBots();
  const availableBots =
    channelFilter === "sms" ? bots?.filter((bot) => bot.smsEnabled) ?? [] : bots ?? [];
  const { data: templates, isLoading, error, refetch } = useTemplates(
    botFilter || undefined,
    channelFilter
  );
  const createWhatsappMutation = useCreateTemplate("whatsapp");
  const createSmsMutation = useCreateTemplate("sms");
  const updateWhatsappMutation = useUpdateTemplate("whatsapp");
  const updateSmsMutation = useUpdateTemplate("sms");
  const deleteWhatsappMutation = useDeleteTemplate("whatsapp");
  const deleteSmsMutation = useDeleteTemplate("sms");
  const sendWhatsappMutation = useSendTemplate("whatsapp");
  const sendSmsMutation = useSendTemplate("sms");

  const [formBotId, setFormBotId] = useState("");
  const [dialogChannel, setDialogChannel] = useState<OutreachChannel>("whatsapp");
  const [formName, setFormName] = useState("");
  const [formLanguage, setFormLanguage] = useState("es");
  const [formCategory, setFormCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [whatsappForm, setWhatsappForm] = useState(EMPTY_WHATSAPP_FORM);
  const [smsForm, setSmsForm] = useState(EMPTY_SMS_FORM);

  const [sendTo, setSendTo] = useState("");
  const [sendParams, setSendParams] = useState<Record<string, string>>({});
  const [sendRequestDlr, setSendRequestDlr] = useState(false);
  const [formError, setFormError] = useState("");
  const [sendError, setSendError] = useState("");

  function openCreate() {
    setFormError("");
    setFormName("");
    setFormLanguage("es");
    setFormCategory("UTILITY");
    setDialogChannel(channelFilter);
    setFormBotId(botFilter);
    setWhatsappForm(EMPTY_WHATSAPP_FORM);
    setSmsForm(EMPTY_SMS_FORM);
    setEditingTemplate(null);
    setDialogMode("create");
  }

  function openEdit(template: MessageTemplate) {
    if (isSmsTemplate(template)) {
      setFormError("");
      setFormName(template.name);
      setFormLanguage(template.language);
      setFormCategory(template.category);
      setDialogChannel("sms");
      setSmsForm({ body: template.body });
      setEditingTemplate(template);
      setDialogMode("edit");
      return;
    }
    if (template.status !== "REJECTED") return;
    setFormError("");
    setFormName(template.name);
    setFormLanguage(template.language);
    setFormCategory(template.category);
    setDialogChannel("whatsapp");
    setWhatsappForm(whatsAppFormFromComponents(template.components));
    setEditingTemplate(template);
    setDialogMode("edit");
  }

  function openSend(template: MessageTemplate) {
    setSendTo("");
    setSendRequestDlr(false);
    const bodyText = isSmsTemplate(template)
      ? template.body
      : template.components.find((c) => c.type === "BODY")?.text ?? "";
    const vars = extractBodyVariables(bodyText);
    const initial: Record<string, string> = {};
    vars.forEach((v) => { initial[v] = ""; });
    setSendParams(initial);
    setSendTarget(template);
  }

  async function handleCreateOrUpdate() {
    const activeChannel = dialogMode === "create" ? dialogChannel : channelFilter;
    const targetBotId =
      dialogMode === "create" ? formBotId : editingTemplate?.botId ?? botFilter;
    if (!targetBotId) return;
    if (activeChannel === "sms" && !smsForm.body.trim()) return;
    if (activeChannel === "whatsapp" && !isWhatsAppFormValid(whatsappForm)) return;

    setFormError("");
    try {
      if (activeChannel === "sms") {
        if (dialogMode === "create") {
          await createSmsMutation.mutateAsync({
            botId: targetBotId,
            name: formName,
            language: formLanguage,
            category: formCategory,
            body: smsForm.body.trim(),
          });
        } else if (dialogMode === "edit" && editingTemplate) {
          await updateSmsMutation.mutateAsync({
            name: editingTemplate.name,
            botId: targetBotId,
            language: editingTemplate.language,
            body: smsForm.body.trim(),
          });
        }
      } else if (dialogMode === "create") {
        await createWhatsappMutation.mutateAsync({
          botId: targetBotId,
          name: formName,
          language: formLanguage,
          category: formCategory,
          components: buildWhatsAppComponents(whatsappForm),
        });
      } else if (dialogMode === "edit" && editingTemplate) {
        await updateWhatsappMutation.mutateAsync({
          name: editingTemplate.name,
          botId: targetBotId,
          language: editingTemplate.language,
          components: buildWhatsAppComponents(whatsappForm),
        });
      }

      if (dialogMode === "create" && dialogChannel !== channelFilter) {
        setChannelFilter(dialogChannel);
      }
      setDialogMode(null);
      refetch();
    } catch (err) {
      setFormError((err as Error).message ?? t("templates.saveError"));
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    const deleteMutation = isSmsTemplate(deleteConfirm) ? deleteSmsMutation : deleteWhatsappMutation;
    await deleteMutation.mutateAsync({
      name: deleteConfirm.name,
      botId: deleteConfirm.botId,
      language: deleteConfirm.language,
    });
    setDeleteConfirm(null);
    refetch();
  }

  async function handleSend() {
    if (!sendTarget || !sendTo.trim()) return;

    const bodyVarKeys = Object.keys(sendParams);
    const bodyParams = bodyVarKeys.length
      ? [{
          type: "body",
          parameters: bodyVarKeys.map((k) => ({ type: "text" as const, text: sendParams[k] })),
        }]
      : undefined;

    const sendMutation = isSmsTemplate(sendTarget) ? sendSmsMutation : sendWhatsappMutation;

    setSendError("");
    try {
      await sendMutation.mutateAsync({
        name: sendTarget.name,
        botId: sendTarget.botId,
        to: sendTo,
        language: sendTarget.language,
        ...(isSmsTemplate(sendTarget) && sendRequestDlr ? { requestDlr: true } : {}),
        components: bodyParams,
      });
      setSendTarget(null);
      setSendRequestDlr(false);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Send failed");
    }
  }

  const activeDialogChannel = dialogMode === "create" ? dialogChannel : channelFilter;
  const dialogBots =
    activeDialogChannel === "sms"
      ? bots?.filter((bot) => bot.smsEnabled) ?? []
      : bots ?? [];
  const botNameById = useMemo(
    () => new Map((bots ?? []).map((bot) => [bot.botId, bot.name])),
    [bots]
  );
  const isSubmitting =
    createWhatsappMutation.isPending ||
    createSmsMutation.isPending ||
    updateWhatsappMutation.isPending ||
    updateSmsMutation.isPending;
  const canSubmitForm =
    (dialogMode !== "create" || !!formBotId) &&
    (activeDialogChannel === "sms"
      ? !!smsForm.body.trim()
      : isWhatsAppFormValid(whatsappForm));

  return (
    <DashboardPage>
      <div data-tour="templates-header">
        <PageHeader
          title={t("templates.title")}
          subtitle={t("templates.subtitle")}
          actions={
            <button
              type="button"
              data-tour="templates-create"
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" />
              {t("templates.createTemplate")}
            </button>
          }
        />
      </div>

      <TourPageSuggestion tourId="templates" />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <ContextualHint hintId="templates-filter" content={t("helpCenter.hints.templatesFilter")}>
          <select
            data-tour="templates-filter"
            value={botFilter}
            onChange={(e) => setBotFilter(e.target.value)}
            className="w-full rounded-lg border border-field-border bg-surface-elevated px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent sm:w-72"
          >
          <option value="">{t("templates.allBots")}</option>
          {availableBots.map((bot) => (
            <option key={bot.botId} value={bot.botId}>
              {bot.name}
            </option>
          ))}
        </select>
        </ContextualHint>
        <OutreachChannelSelect
          value={channelFilter}
          onChange={(value) => {
            setChannelFilter(value);
            setDialogMode(null);
          }}
          className="w-full rounded-lg border border-field-border bg-surface-elevated px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent sm:w-56"
        />
      </div>

      {channelFilter === "whatsapp" && (
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 mb-2">{t("templates.lifecycleTitle")}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-blue-700">
              <div className="flex items-center gap-1.5 bg-surface-elevated border border-blue-200 rounded-lg px-2.5 py-1.5">
                <Clock className="w-3.5 h-3.5 text-yellow-500" />
                <span className="font-medium">{t("templates.lifecyclePending")}</span>
                <span className="text-blue-500">{t("templates.lifecyclePendingDesc")}</span>
              </div>
              <span className="text-blue-400">→</span>
              <div className="flex items-center gap-1.5 bg-surface-elevated border border-blue-200 rounded-lg px-2.5 py-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                <span className="font-medium">{t("templates.lifecycleApproved")}</span>
                <span className="text-blue-500">{t("templates.lifecycleApprovedDesc")}</span>
              </div>
              <span className="text-blue-400">{t("templates.lifecycleOr")}</span>
              <div className="flex items-center gap-1.5 bg-surface-elevated border border-blue-200 rounded-lg px-2.5 py-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="font-medium">{t("templates.lifecycleRejected")}</span>
                <span className="text-blue-500">{t("templates.lifecycleRejectedDesc")}</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">{t("templates.lifecycleNote")}</p>
          </div>
        </div>
      </div>
      )}

      {channelFilter === "sms" && (
        <div className="mb-6 bg-surface border border-default rounded-xl p-4">
          <p className="text-sm text-secondary">{t("templates.smsLifecycleNote")}</p>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface-elevated rounded-xl border border-default p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="h-4 w-40 bg-gray-200 rounded" />
                <div className="h-4 w-16 bg-gray-200 rounded-full" />
                <div className="h-4 w-16 bg-gray-200 rounded-full" />
                <div className="flex-1" />
                <div className="h-8 w-20 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600">{t("templates.loadErrorRetry")}</p>
        </div>
      )}

      {!isLoading && !error && templates?.length === 0 && (
        <EmptyState
          icon={<LayoutTemplate className="w-6 h-6" />}
          title={t("templates.emptyTitle")}
          description={t("templates.emptyDescription")}
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t("templates.createTemplate")}
            </button>
          }
        />
      )}

      {!isLoading && templates && templates.length > 0 && (
        <div data-tour="templates-table">
        <TableContainer className="overflow-hidden rounded-xl border border-default bg-surface-elevated">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-default bg-surface">
                <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-5 py-3">
                  {t("templates.colName")}
                </th>
                {!botFilter && (
                  <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-5 py-3">
                    {t("templates.colBot")}
                  </th>
                )}
                <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-5 py-3">
                  {t("templates.language")}
                </th>
                <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-5 py-3">
                  {t("templates.category")}
                </th>
                <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-5 py-3">
                  {t("common.status")}
                </th>
                <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-5 py-3">
                  {t("templates.colSynced")}
                </th>
                <th className="text-right text-xs font-medium text-secondary uppercase tracking-wider px-5 py-3">
                  {t("templates.colActions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((tpl) => {
                const sms = isSmsTemplate(tpl);
                const statusInfo = STATUS_BADGE[tpl.status as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.PENDING;
                const canSend = tpl.status === "APPROVED";
                const canEdit = sms || tpl.status === "REJECTED";
                return (
                  <tr key={`${tpl.botId}-${tpl.name}-${tpl.language}`} className="hover:bg-surface transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="w-4 h-4 text-muted" />
                        <span className="text-sm font-medium text-primary">{tpl.name}</span>
                      </div>
                    </td>
                    {!botFilter && (
                      <td className="px-5 py-4 text-sm text-secondary">
                        {botNameById.get(tpl.botId) ?? tpl.botId}
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Languages className="w-3.5 h-3.5 text-muted" />
                        <span className="text-sm text-secondary">{tpl.language}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-muted" />
                        <span className="text-sm text-secondary">
                          {CATEGORY_LABELS[tpl.category as keyof typeof CATEGORY_LABELS] ?? tpl.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div
                        title={
                          tpl.status === "PENDING"
                            ? t("templates.tooltipPending")
                            : tpl.status === "REJECTED"
                            ? t("templates.tooltipRejected")
                            : t("templates.tooltipApproved")
                        }
                      >
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-secondary">
                      {formatDate(sms ? tpl.updatedAt : tpl.syncedAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {canSend && (
                          <button
                            onClick={() => openSend(tpl)}
                            className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent-muted transition-colors"
                            title={t("templates.send")}
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {canEdit ? (
                          <button
                            onClick={() => openEdit(tpl)}
                            className="p-1.5 rounded-md text-muted hover:text-secondary hover:bg-surface-muted transition-colors"
                            title={sms ? t("common.edit") : t("templates.editResubmit")}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        ) : (
                          <span
                            className="p-1.5 rounded-md text-gray-300 cursor-not-allowed"
                            title={
                              tpl.status === "APPROVED"
                                ? t("templates.cannotEditApproved")
                                : t("templates.waitMetaReview")
                            }
                          >
                            <Pencil className="w-4 h-4" />
                          </span>
                        )}
                        <button
                          onClick={() => setDeleteConfirm(tpl)}
                          className="p-1.5 rounded-md text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                          title={t("common.delete")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableContainer>
        </div>
      )}

      {dialogMode && (
        <Modal>
          <div className="bg-surface-elevated rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-default">
              <h2 className="text-lg font-semibold text-primary">
                {dialogMode === "create" ? t("templates.createDialog") : t("templates.editDialog")}
              </h2>
              <button
                onClick={() => setDialogMode(null)}
                className="p-1 rounded-md text-muted hover:text-secondary hover:bg-surface-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{formError}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">{t("templates.name")}</label>
                <Input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  disabled={dialogMode === "edit"}
                  placeholder={t("templates.namePlaceholder")}
                />
                <p className="text-xs text-muted mt-1">{t("templates.nameHint")}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">{t("templates.language")}</label>
                  <Select
                    value={formLanguage}
                    onChange={(e) => setFormLanguage(e.target.value)}
                    disabled={dialogMode === "edit"}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">{t("templates.category")}</label>
                  <Select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as typeof formCategory)}
                    disabled={dialogMode === "edit"}
                  >
                    <option value="UTILITY">{t("templates.categoryUtility")}</option>
                    <option value="MARKETING">{t("templates.categoryMarketing")}</option>
                    <option value="AUTHENTICATION">{t("templates.categoryAuth")}</option>
                  </Select>
                </div>
              </div>
              {dialogMode === "create" && (
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">{t("templates.colBot")}</label>
                  <Select
                    value={formBotId}
                    onChange={(e) => setFormBotId(e.target.value)}
                  >
                    <option value="">{t("templates.selectBotTitle")}</option>
                    {dialogBots.map((bot) => (
                      <option key={bot.botId} value={bot.botId}>
                        {bot.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <TemplateChannelForm
                channel={activeDialogChannel}
                onChannelChange={dialogMode === "create" ? setDialogChannel : undefined}
                showChannelSelect={dialogMode === "create"}
                whatsapp={whatsappForm}
                onWhatsappChange={setWhatsappForm}
                sms={smsForm}
                onSmsChange={setSmsForm}
                previewName={formName || "preview"}
              />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-default">
              <button
                onClick={() => setDialogMode(null)}
                className="px-4 py-2 text-sm font-medium text-secondary bg-surface-elevated border border-field-border rounded-lg hover:bg-surface transition-colors"
              >
                {t("templates.cancelDialog")}
              </button>
              <button
                onClick={handleCreateOrUpdate}
                disabled={
                  isSubmitting ||
                  !canSubmitForm ||
                  (dialogMode === "create" && !formName.trim())
                }
                className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t("auth.saving") : dialogMode === "create" ? t("common.create") : t("common.update")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {sendTarget && (
        <Modal>
          <div className="bg-surface-elevated rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-default">
              <h2 className="text-lg font-semibold text-primary">
                {t("templates.sendTitle", { name: sendTarget.name })}
              </h2>
              <button
                onClick={() => setSendTarget(null)}
                className="p-1 rounded-md text-muted hover:text-secondary hover:bg-surface-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  {t("templates.sendTo")}
                </label>
                <Input
                  type="tel"
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("templates.sendToPlaceholder")}
                />
                <p className="text-xs text-muted mt-1">{t("templates.sendToHint")}</p>
              </div>

              {channelFilter === "sms" && isSmsTemplate(sendTarget) && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendRequestDlr}
                    onChange={(e) => setSendRequestDlr(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-field-border text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-secondary">
                    <span className="font-medium">{t("campaigns.requestDlr")}</span>
                    <span className="block text-xs text-secondary mt-0.5">{t("campaigns.requestDlrHint")}</span>
                  </span>
                </label>
              )}

              {Object.keys(sendParams).length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-secondary">{t("templates.templateVars")}</p>
                  {Object.keys(sendParams).map((key) => (
                    <div key={key}>
                      <label className="block text-xs text-secondary mb-1">{key}</label>
                      <Input
                        type="text"
                        value={sendParams[key]}
                        onChange={(e) =>
                          setSendParams((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={t("templates.valueFor", { key })}
                      />
                    </div>
                  ))}
                </div>
              )}

              {isSmsTemplate(sendTarget) ? (
                <SmsTemplatePreview
                  template={sendTarget}
                  label={t("templates.previewLabel")}
                />
              ) : (
              <div className="bg-surface rounded-xl p-4">
                <p className="text-xs font-medium text-secondary mb-2">{t("templates.previewLabel")}</p>
                <div className="bg-surface-elevated rounded-lg p-3 border border-default">
                  {sendTarget.components.find((c) => c.type === "HEADER")?.text && (
                    <p className="text-sm font-semibold text-primary mb-1">
                      {sendTarget.components.find((c) => c.type === "HEADER")!.text}
                    </p>
                  )}
                  <p className="text-sm text-secondary whitespace-pre-wrap">
                    {(() => {
                      let body = sendTarget.components.find((c) => c.type === "BODY")?.text ?? "";
                      Object.entries(sendParams).forEach(([key, val]) => {
                        if (val) body = body.replace(key, val);
                      });
                      return body;
                    })()}
                  </p>
                  {sendTarget.components.find((c) => c.type === "FOOTER")?.text && (
                    <p className="text-xs text-muted mt-2">
                      {sendTarget.components.find((c) => c.type === "FOOTER")!.text}
                    </p>
                  )}
                </div>
              </div>
              )}
            </div>
            {sendError && (
              <p className="px-6 pb-2 text-sm text-red-600">{sendError}</p>
            )}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-default">
              <button
                onClick={() => setSendTarget(null)}
                className="px-4 py-2 text-sm font-medium text-secondary bg-surface-elevated border border-field-border rounded-lg hover:bg-surface transition-colors"
              >
                {t("templates.cancelDialog")}
              </button>
              <button
                onClick={handleSend}
                disabled={sendWhatsappMutation.isPending || sendSmsMutation.isPending || !sendTo.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {sendWhatsappMutation.isPending || sendSmsMutation.isPending ? t("templates.sending") : t("templates.send")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal>
          <div className="bg-surface-elevated rounded-2xl shadow-xl w-full max-w-sm mx-4">
            <div className="px-6 py-5">
              <h2 className="text-lg font-semibold text-primary mb-2">{t("templates.confirmDeleteTitle")}</h2>
              <p className="text-sm text-secondary">
                {t("templates.confirmDeleteBody", { name: deleteConfirm.name })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-default">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-secondary bg-surface-elevated border border-field-border rounded-lg hover:bg-surface transition-colors"
              >
                {t("templates.cancelDialog")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteWhatsappMutation.isPending || deleteSmsMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteWhatsappMutation.isPending || deleteSmsMutation.isPending ? t("templates.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardPage>
  );
}
