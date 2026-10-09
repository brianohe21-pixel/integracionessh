"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Check,
  Eye,
  KeyRound,
  MessageSquareText,
  Megaphone,
  MessageCircle,
  Smartphone,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { SideDrawer } from "@/components/ui/SideDrawer";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { SmsTemplatePreview } from "@/components/templates/SmsTemplatePreview";
import { TemplateMessagePreview } from "@/components/templates/TemplateMessagePreview";
import { AuthOtpTemplateFormFields } from "@/components/templates/channel/AuthOtpTemplateFormFields";
import { SmsTemplateFormFields } from "@/components/templates/channel/SmsTemplateFormFields";
import { WhatsAppTemplateFormFields } from "@/components/templates/channel/WhatsAppTemplateFormFields";
import {
  buildAuthOtpComponents,
  buildWhatsAppComponents,
  type AuthOtpTemplateFormValues,
  type SmsTemplateFormValues,
  type TemplateCategory,
  type WhatsAppTemplateFormValues,
} from "@/components/templates/channel/types";
import type { OutreachChannel } from "@/types";
import { cn } from "@/lib/utils";

type DialogMode = "create" | "edit";

interface LanguageOption {
  code: string;
  label: string;
}

interface BotOption {
  botId: string;
  name: string;
}

interface TemplateEditorDialogProps {
  mode: DialogMode;
  channel: OutreachChannel;
  onChannelChange?: (channel: OutreachChannel) => void;
  showChannelSelect: boolean;
  bots: BotOption[];
  botId: string;
  onBotIdChange: (botId: string) => void;
  name: string;
  onNameChange: (name: string) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  languages: LanguageOption[];
  category: TemplateCategory;
  onCategoryChange: (category: TemplateCategory) => void;
  whatsapp: WhatsAppTemplateFormValues;
  onWhatsappChange: (values: WhatsAppTemplateFormValues) => void;
  authOtp: AuthOtpTemplateFormValues;
  onAuthOtpChange: (values: AuthOtpTemplateFormValues) => void;
  sms: SmsTemplateFormValues;
  onSmsChange: (values: SmsTemplateFormValues) => void;
  error?: string;
  submitting: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

const CATEGORY_META: Array<{
  id: TemplateCategory;
  icon: typeof Megaphone;
  labelKey: string;
  descriptionKey: string;
  whatsappOnly?: boolean;
}> = [
  {
    id: "UTILITY",
    icon: MessageSquareText,
    labelKey: "templates.categoryUtility",
    descriptionKey: "templates.categoryUtilityDesc",
  },
  {
    id: "MARKETING",
    icon: Megaphone,
    labelKey: "templates.categoryMarketing",
    descriptionKey: "templates.categoryMarketingDesc",
  },
  {
    id: "AUTHENTICATION",
    icon: KeyRound,
    labelKey: "templates.categoryAuth",
    descriptionKey: "templates.categoryAuthDesc",
    whatsappOnly: true,
  },
];

function SectionHeader({
  step,
  title,
  hint,
}: {
  step?: number;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {typeof step === "number" ? (
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-semibold text-accent">
          {step}
        </span>
      ) : null}
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs leading-snug text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

export function TemplateEditorDialog({
  mode,
  channel,
  onChannelChange,
  showChannelSelect,
  bots,
  botId,
  onBotIdChange,
  name,
  onNameChange,
  language,
  onLanguageChange,
  languages,
  category,
  onCategoryChange,
  whatsapp,
  onWhatsappChange,
  authOtp,
  onAuthOtpChange,
  sms,
  onSmsChange,
  error,
  submitting,
  canSubmit,
  onClose,
  onSubmit,
}: TemplateEditorDialogProps) {
  const t = useT();
  const formScrollRef = useRef<HTMLDivElement>(null);
  const isAuthOtp = channel === "whatsapp" && category === "AUTHENTICATION";
  const isCreate = mode === "create";
  const nameLocked = mode === "edit";
  const metaLocked = mode === "edit";

  useEffect(() => {
    if (!error) return;
    formScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [error]);

  const categoryOptions = CATEGORY_META.filter(
    (item) => !(item.whatsappOnly && channel === "sms")
  );

  const namePlaceholder = isAuthOtp
    ? t("templates.namePlaceholderAuth")
    : category === "MARKETING"
      ? t("templates.namePlaceholderMarketing")
      : t("templates.namePlaceholder");

  const subtitle = isAuthOtp
    ? t("templates.createDialogAuthSubtitle")
    : channel === "sms"
      ? t("templates.createDialogSmsSubtitle")
      : t("templates.createDialogWhatsappSubtitle");

  const whatsappPreview = useMemo(
    () => ({
      templateId: "preview",
      tenantId: "",
      botId: "",
      name: name || "preview",
      language,
      category: isAuthOtp ? ("AUTHENTICATION" as const) : category,
      status: "APPROVED" as const,
      components: isAuthOtp
        ? buildAuthOtpComponents(authOtp)
        : buildWhatsAppComponents(whatsapp),
      syncedAt: "",
      createdAt: "",
    }),
    [authOtp, category, isAuthOtp, language, name, whatsapp]
  );

  const smsPreview = useMemo(
    () => ({
      templateId: "preview",
      tenantId: "",
      botId: "",
      channel: "sms" as const,
      name: name || "preview",
      language,
      category,
      status: "APPROVED" as const,
      body: sms.body,
      createdAt: "",
      updatedAt: "",
    }),
    [category, language, name, sms.body]
  );

  const hasPreview =
    channel === "sms"
      ? Boolean(sms.body.trim())
      : isAuthOtp || Boolean(whatsapp.bodyText.trim());

  const submitBlockedReason = !botId && isCreate
    ? t("templates.footerHintSelectBot")
    : isCreate && !name.trim()
      ? t("templates.footerHintName")
      : !canSubmit
        ? t("templates.footerHintContent")
        : null;

  const previewPanel = (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-secondary">
          {channel === "sms" ? (
            <Smartphone className="h-3.5 w-3.5" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" />
          )}
          {channel === "sms" ? t("outreach.channelSms") : t("outreach.channelWhatsapp")}
        </span>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-secondary">
          {CATEGORY_LABEL(category, t)}
        </span>
      </div>

      {hasPreview ? (
        channel === "sms" ? (
          <SmsTemplatePreview template={smsPreview} />
        ) : (
          <TemplateMessagePreview template={whatsappPreview} />
        )
      ) : (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-default bg-surface-elevated/70 px-6 text-center">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-muted">
            <Eye className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-secondary">{t("templates.previewEmpty")}</p>
          <p className="mt-1 text-xs text-muted">{t("templates.previewEmptyHint")}</p>
        </div>
      )}
    </div>
  );

  return (
    <SideDrawer
      title={isCreate ? t("templates.createDialog") : t("templates.editDialog")}
      subtitle={subtitle}
      onClose={onClose}
      widthClass="max-w-6xl"
      contentClassName="min-h-0 overflow-hidden"
      footer={
        <div className="flex flex-col gap-3">
          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"
            >
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-xs ${error ? "text-red-600" : "text-muted"}`}>
              {error
                ? t("templates.footerHintError")
                : (submitBlockedReason ?? t("templates.footerHintReady"))}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                {t("templates.cancelDialog")}
              </Button>
              <Button
                onClick={onSubmit}
                disabled={submitting || !canSubmit || (isCreate && !name.trim())}
              >
                {submitting
                  ? t("auth.saving")
                  : isCreate
                    ? t("common.create")
                    : t("common.update")}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div ref={formScrollRef} className="space-y-6 overflow-y-auto px-5 py-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"
            >
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <section className="space-y-4 rounded-2xl border border-default bg-surface p-4">
            <SectionHeader
              step={1}
              title={t("templates.setupSection")}
              hint={t("templates.setupSectionHint")}
            />

            {showChannelSelect && onChannelChange && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-secondary">
                  {t("outreach.channel")}
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-1">
                  {(
                    [
                      {
                        id: "whatsapp" as const,
                        label: t("outreach.channelWhatsapp"),
                        icon: MessageCircle,
                      },
                      {
                        id: "sms" as const,
                        label: t("outreach.channelSms"),
                        icon: Smartphone,
                      },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const selected = channel === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onChannelChange(item.id)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                          selected
                            ? "bg-surface-elevated text-primary shadow-sm ring-1 ring-black/5"
                            : "text-secondary hover:text-primary"
                        )}
                      >
                        <Icon className={cn("h-4 w-4", selected ? "text-accent" : "text-muted")} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isCreate && (
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t("templates.colBot")}
                </label>
                <Select value={botId} onChange={(e) => onBotIdChange(e.target.value)}>
                  <option value="">{t("templates.selectBotTitle")}</option>
                  {bots.map((bot) => (
                    <option key={bot.botId} value={bot.botId}>
                      {bot.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-secondary">
                  {t("templates.category")}
                </label>
                <p className="mt-0.5 text-xs text-muted">{t("templates.categoryPickerHint")}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {categoryOptions.map((item) => {
                  const Icon = item.icon;
                  const selected = category === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={metaLocked}
                      onClick={() => onCategoryChange(item.id)}
                      className={cn(
                        "relative rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
                        selected
                          ? "border-accent bg-accent-muted/35 shadow-sm ring-1 ring-accent"
                          : "border-default bg-surface-elevated hover:border-accent/40 hover:bg-surface"
                      )}
                    >
                      {selected ? (
                        <span className="absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg",
                          selected ? "bg-accent text-white" : "bg-surface-muted text-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-semibold text-primary">{t(item.labelKey)}</p>
                      <p className="mt-1 text-xs leading-snug text-muted">
                        {t(item.descriptionKey)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t("templates.language")}
                </label>
                <Select
                  value={language}
                  onChange={(e) => onLanguageChange(e.target.value)}
                  disabled={metaLocked}
                >
                  {languages.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t("templates.name")}
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) =>
                    onNameChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                  }
                  disabled={nameLocked}
                  placeholder={namePlaceholder}
                />
                <p className="mt-1 text-xs text-muted">{t("templates.nameHint")}</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-default bg-surface p-4">
            <SectionHeader
              step={2}
              title={t("templates.contentSection")}
              hint={
                isAuthOtp
                  ? t("templates.contentSectionAuthHint")
                  : channel === "sms"
                    ? t("templates.contentSectionSmsHint")
                    : t("templates.contentSectionWhatsappHint")
              }
            />

            {channel === "sms" ? (
              <SmsTemplateFormFields values={sms} onChange={onSmsChange} />
            ) : isAuthOtp ? (
              <AuthOtpTemplateFormFields values={authOtp} onChange={onAuthOtpChange} />
            ) : (
              <WhatsAppTemplateFormFields values={whatsapp} onChange={onWhatsappChange} />
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-default bg-surface p-4 lg:hidden">
            <SectionHeader title={t("templates.previewLabel")} hint={t("templates.previewSidebarHint")} />
            {previewPanel}
          </section>
        </div>

        <aside className="hidden min-h-0 border-l border-default bg-surface lg:flex lg:flex-col">
          <div className="border-b border-default px-5 py-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted" />
              <p className="text-sm font-semibold text-primary">{t("templates.previewLabel")}</p>
            </div>
            <p className="mt-1 text-xs text-muted">{t("templates.previewSidebarHint")}</p>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{previewPanel}</div>
        </aside>
      </div>
    </SideDrawer>
  );
}

function CATEGORY_LABEL(
  category: TemplateCategory,
  t: (key: string) => string
): string {
  if (category === "MARKETING") return t("templates.categoryMarketing");
  if (category === "AUTHENTICATION") return t("templates.categoryAuth");
  return t("templates.categoryUtility");
}
