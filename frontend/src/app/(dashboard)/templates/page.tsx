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
import { TemplateMessagePreview } from "@/components/templates/TemplateMessagePreview";
import { TemplateEditorDialog } from "@/components/templates/TemplateEditorDialog";
import {
  authOtpFormFromComponents,
  buildAuthOtpComponents,
  buildWhatsAppComponents,
  EMPTY_AUTH_OTP_FORM,
  EMPTY_SMS_FORM,
  EMPTY_WHATSAPP_FORM,
  isAuthOtpFormValid,
  isAuthenticationTemplate,
  isWhatsAppFormValid,
  whatsAppFormFromComponents,
} from "@/components/templates/channel/types";
import { extractBodyVariables } from "@/lib/templates/variables";
import {
  buildTemplateSendComponents,
  emptySlotValues,
  listTemplateSendSlots,
  placeholderValues,
  slotsAreComplete,
  type TemplateSendSlot,
} from "@/lib/templates/send-components";
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
import { Input } from "@/components/ui/Input";

type DialogMode = "create" | "edit" | null;

function sendSlotLabel(
  slot: TemplateSendSlot,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  if (slot.kind === "auth_code") return t("templates.authOtpCodeLabel");
  if (slot.kind === "header_text") return t("templates.sendVarHeader", { key: slot.placeholder });
  if (slot.kind === "button_url") {
    return t("templates.sendVarButton", {
      name: slot.buttonText?.trim() || String((slot.buttonIndex ?? 0) + 1),
      key: slot.placeholder,
    });
  }
  return slot.placeholder;
}

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
  const [authOtpForm, setAuthOtpForm] = useState(EMPTY_AUTH_OTP_FORM);
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
    setAuthOtpForm(EMPTY_AUTH_OTP_FORM);
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
    if (
      template.category === "AUTHENTICATION" ||
      isAuthenticationTemplate(template.components)
    ) {
      setAuthOtpForm(authOtpFormFromComponents(template.components));
      setWhatsappForm(EMPTY_WHATSAPP_FORM);
    } else {
      setWhatsappForm(whatsAppFormFromComponents(template.components));
      setAuthOtpForm(EMPTY_AUTH_OTP_FORM);
    }
    setEditingTemplate(template);
    setDialogMode("edit");
  }

  function openSend(template: MessageTemplate) {
    setSendTo("");
    setSendRequestDlr(false);
    setSendError("");
    if (isSmsTemplate(template)) {
      const vars = extractBodyVariables(template.body);
      const initial: Record<string, string> = {};
      vars.forEach((v) => {
        initial[v] = "";
      });
      setSendParams(initial);
      setSendTarget(template);
      return;
    }
    setSendParams(emptySlotValues(listTemplateSendSlots(template)));
    setSendTarget(template);
  }

  async function handleCreateOrUpdate() {
    const activeChannel = dialogMode === "create" ? dialogChannel : channelFilter;
    const targetBotId =
      dialogMode === "create" ? formBotId : editingTemplate?.botId ?? botFilter;
    const isAuthOtpWhatsapp =
      activeChannel === "whatsapp" && formCategory === "AUTHENTICATION";
    if (!targetBotId) return;
    if (activeChannel === "sms" && !smsForm.body.trim()) return;
    if (isAuthOtpWhatsapp && !isAuthOtpFormValid(authOtpForm)) return;
    if (
      activeChannel === "whatsapp" &&
      !isAuthOtpWhatsapp &&
      !isWhatsAppFormValid(whatsappForm)
    ) {
      return;
    }

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
          components: isAuthOtpWhatsapp
            ? buildAuthOtpComponents(authOtpForm)
            : buildWhatsAppComponents(whatsappForm),
        });
      } else if (dialogMode === "edit" && editingTemplate) {
        await updateWhatsappMutation.mutateAsync({
          name: editingTemplate.name,
          botId: targetBotId,
          language: editingTemplate.language,
          components: isAuthOtpWhatsapp
            ? buildAuthOtpComponents(authOtpForm)
            : buildWhatsAppComponents(whatsappForm),
        });
      }

      if (dialogMode === "create" && dialogChannel !== channelFilter) {
        setChannelFilter(dialogChannel);
      }
      setDialogMode(null);
      refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message.trim() : "";
      setFormError(message || t("templates.saveError"));
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

    const sendMutation = isSmsTemplate(sendTarget) ? sendSmsMutation : sendWhatsappMutation;
    const components = isSmsTemplate(sendTarget)
      ? Object.keys(sendParams).length
        ? [
            {
              type: "body",
              parameters: Object.keys(sendParams).map((k) => ({
                type: "text" as const,
                text: sendParams[k],
              })),
            },
          ]
        : undefined
      : buildTemplateSendComponents(sendTarget, sendParams);

    setSendError("");
    try {
      await sendMutation.mutateAsync({
        name: sendTarget.name,
        botId: sendTarget.botId,
        to: sendTo,
        language: sendTarget.language,
        ...(isSmsTemplate(sendTarget) && sendRequestDlr ? { requestDlr: true } : {}),
        components,
      });
      setSendTarget(null);
      setSendRequestDlr(false);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Send failed");
    }
  }

  const sendSlots = useMemo(() => {
    if (!sendTarget || isSmsTemplate(sendTarget)) return [];
    return listTemplateSendSlots(sendTarget);
  }, [sendTarget]);

  const sendSmsVarKeys = useMemo(() => {
    if (!sendTarget || !isSmsTemplate(sendTarget)) return [];
    return Object.keys(sendParams);
  }, [sendTarget, sendParams]);

  const canConfirmSend =
    Boolean(sendTo.trim()) &&
    (sendTarget && isSmsTemplate(sendTarget)
      ? sendSmsVarKeys.every((key) => Boolean(sendParams[key]?.trim()))
      : slotsAreComplete(sendSlots, sendParams));

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
      : formCategory === "AUTHENTICATION"
        ? isAuthOtpFormValid(authOtpForm)
        : isWhatsAppFormValid(whatsappForm));

  const renderTemplateActions = (tpl: MessageTemplate, align: "start" | "end" = "end") => {
    const sms = isSmsTemplate(tpl);
    const canSend = tpl.status === "APPROVED";
    const canEdit = sms || tpl.status === "REJECTED";
    return (
      <div className={`flex items-center gap-1 ${align === "end" ? "justify-end" : "justify-start"}`}>
        {canSend && (
          <button
            type="button"
            onClick={() => openSend(tpl)}
            className="rounded-md p-2 text-muted transition-colors hover:bg-accent-muted hover:text-accent"
            title={t("templates.send")}
            aria-label={t("templates.send")}
          >
            <Send className="h-4 w-4" />
          </button>
        )}
        {canEdit ? (
          <button
            type="button"
            onClick={() => openEdit(tpl)}
            className="rounded-md p-2 text-muted transition-colors hover:bg-surface-muted hover:text-secondary"
            title={sms ? t("common.edit") : t("templates.editResubmit")}
            aria-label={sms ? t("common.edit") : t("templates.editResubmit")}
          >
            <Pencil className="h-4 w-4" />
          </button>
        ) : (
          <span
            className="cursor-not-allowed rounded-md p-2 text-gray-300"
            title={
              tpl.status === "APPROVED"
                ? t("templates.cannotEditApproved")
                : t("templates.waitMetaReview")
            }
          >
            <Pencil className="h-4 w-4" />
          </span>
        )}
        <button
          type="button"
          onClick={() => setDeleteConfirm(tpl)}
          className="rounded-md p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-600"
          title={t("common.delete")}
          aria-label={t("common.delete")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

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
          {error instanceof Error && error.message && (
            <p className="mt-2 text-xs text-red-700">{error.message}</p>
          )}
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
          <div className="space-y-3 md:hidden">
            {templates.map((tpl) => {
              const sms = isSmsTemplate(tpl);
              const statusInfo = STATUS_BADGE[tpl.status as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.PENDING;
              return (
                <div
                  key={`${tpl.botId}-${tpl.name}-${tpl.language}`}
                  className="rounded-xl border border-default bg-surface-elevated p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate text-sm font-medium text-primary">{tpl.name}</span>
                      </div>
                      {!botFilter ? (
                        <p className="mt-1 truncate text-xs text-secondary">
                          {botNameById.get(tpl.botId) ?? tpl.botId}
                        </p>
                      ) : null}
                    </div>
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
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Languages className="h-3.5 w-3.5 text-muted" />
                      {tpl.language}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5 text-muted" />
                      {CATEGORY_LABELS[tpl.category as keyof typeof CATEGORY_LABELS] ?? tpl.category}
                    </span>
                    <span>{formatDate(sms ? tpl.updatedAt : tpl.syncedAt)}</span>
                  </div>

                  <div className="mt-3 border-t border-default pt-3">
                    {renderTemplateActions(tpl, "start")}
                  </div>
                </div>
              );
            })}
          </div>

          <TableContainer className="hidden rounded-xl border border-default bg-surface-elevated md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-default bg-surface">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary">
                    {t("templates.colName")}
                  </th>
                  {!botFilter && (
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary">
                      {t("templates.colBot")}
                    </th>
                  )}
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary">
                    {t("templates.language")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary">
                    {t("templates.category")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary">
                    {t("common.status")}
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary">
                    {t("templates.colSynced")}
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-secondary">
                    {t("templates.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templates.map((tpl) => {
                  const sms = isSmsTemplate(tpl);
                  const statusInfo = STATUS_BADGE[tpl.status as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.PENDING;
                  return (
                    <tr key={`${tpl.botId}-${tpl.name}-${tpl.language}`} className="transition-colors hover:bg-surface">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <LayoutTemplate className="h-4 w-4 text-muted" />
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
                          <Languages className="h-3.5 w-3.5 text-muted" />
                          <span className="text-sm text-secondary">{tpl.language}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5 text-muted" />
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
                      <td className="px-5 py-4">{renderTemplateActions(tpl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableContainer>
        </div>
      )}

      {dialogMode && (
        <TemplateEditorDialog
          mode={dialogMode}
          channel={activeDialogChannel}
          onChannelChange={
            dialogMode === "create"
              ? (nextChannel) => {
                  setDialogChannel(nextChannel);
                  if (nextChannel === "sms" && formCategory === "AUTHENTICATION") {
                    setFormCategory("UTILITY");
                    setWhatsappForm(EMPTY_WHATSAPP_FORM);
                  }
                }
              : undefined
          }
          showChannelSelect={dialogMode === "create"}
          bots={dialogBots.map((bot) => ({ botId: bot.botId, name: bot.name }))}
          botId={formBotId}
          onBotIdChange={setFormBotId}
          name={formName}
          onNameChange={setFormName}
          language={formLanguage}
          onLanguageChange={setFormLanguage}
          languages={LANGUAGES}
          category={formCategory}
          onCategoryChange={(next) => {
            setFormCategory(next);
            if (next === "AUTHENTICATION") {
              setAuthOtpForm(EMPTY_AUTH_OTP_FORM);
            } else {
              setWhatsappForm(EMPTY_WHATSAPP_FORM);
            }
          }}
          whatsapp={whatsappForm}
          onWhatsappChange={setWhatsappForm}
          authOtp={authOtpForm}
          onAuthOtpChange={setAuthOtpForm}
          sms={smsForm}
          onSmsChange={setSmsForm}
          error={formError}
          submitting={isSubmitting}
          canSubmit={canSubmitForm}
          onClose={() => setDialogMode(null)}
          onSubmit={handleCreateOrUpdate}
        />
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

              {(sendSlots.length > 0 || sendSmsVarKeys.length > 0) && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-secondary">{t("templates.templateVars")}</p>
                  {isSmsTemplate(sendTarget)
                    ? sendSmsVarKeys.map((key) => (
                        <div key={key}>
                          <label className="block text-xs text-secondary mb-1">{key}</label>
                          <Input
                            type="text"
                            value={sendParams[key] ?? ""}
                            onChange={(e) =>
                              setSendParams((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder={t("templates.valueFor", { key })}
                          />
                        </div>
                      ))
                    : sendSlots.map((slot) => (
                        <div key={slot.key}>
                          <label className="block text-xs text-secondary mb-1">
                            {sendSlotLabel(slot, t)}
                          </label>
                          <Input
                            type="text"
                            value={sendParams[slot.key] ?? ""}
                            onChange={(e) =>
                              setSendParams((prev) => ({
                                ...prev,
                                [slot.key]: e.target.value,
                              }))
                            }
                            placeholder={
                              slot.kind === "auth_code"
                                ? "123456"
                                : t("templates.valueFor", { key: slot.placeholder })
                            }
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
                <TemplateMessagePreview
                  template={sendTarget}
                  variableValues={
                    placeholderValues(sendSlots, sendParams, "auth_code") ??
                    placeholderValues(sendSlots, sendParams, "body_text")
                  }
                  headerVariableValues={placeholderValues(
                    sendSlots,
                    sendParams,
                    "header_text"
                  )}
                  label={t("templates.previewLabel")}
                />
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
                disabled={
                  sendWhatsappMutation.isPending ||
                  sendSmsMutation.isPending ||
                  !canConfirmSend
                }
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
