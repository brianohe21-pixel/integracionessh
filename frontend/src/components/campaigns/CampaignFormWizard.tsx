"use client";

import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  MessageSquare,
  Tags,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useTemplates } from "@/hooks/useTemplates";
import type { CampaignRecipient } from "@/hooks/useCampaigns";
import { SegmentInput } from "@/components/campaigns/SegmentInput";
import { CampaignContactPicker } from "@/components/campaigns/CampaignContactPicker";
import { CampaignQualityAlert } from "@/components/campaigns/CampaignQualityAlert";
import {
  CampaignBatchSettings,
  DEFAULT_BATCH_FORM,
  batchFormToConfig,
  validateBatchForm,
  formatBatchDelay,
  estimateBatchCount,
  type BatchFormState,
} from "@/components/campaigns/CampaignBatchSettings";
import { TemplateMessagePreview } from "@/components/templates/TemplateMessagePreview";
import { useWhatsAppQualityGuard } from "@/hooks/useWhatsAppQualityGuard";
import { parseRecipientsCsv, decodeCsvBytes } from "@/lib/csv";
import type { MessageTemplate, OutreachChannel } from "@/types";
import { isSmsTemplate } from "@/types";
import { OutreachChannelSelect } from "@/components/outreach/OutreachChannelSelect";
import { SmsTemplatePreview } from "@/components/templates/SmsTemplatePreview";
import { listOutreachAgents } from "@/lib/outreach-agents";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input, SelectControl } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type Step = "config" | "recipients" | "review";

const STEPS: Step[] = ["config", "recipients", "review"];

export interface CampaignConfigForm {
  name: string;
  channel: OutreachChannel;
  botId: string;
  templateName: string;
  language: string;
  segments: string[];
  scheduledAt: string;
}

export interface CampaignFormValues {
  config: CampaignConfigForm;
  recipients: CampaignRecipient[];
  audienceTags: string[];
  batchForm: BatchFormState;
  requireOptIn: boolean;
  requestDlr: boolean;
}

export interface CampaignFormSubmitInput {
  name: string;
  botId: string;
  channel: OutreachChannel;
  templateName: string;
  language: string;
  segments: string[];
  scheduledAt?: string | null;
  batchConfig?: { size: number; delaySeconds: number };
  recipients?: CampaignRecipient[];
  audienceTags?: string[];
  requireOptIn?: boolean;
  requestDlr?: boolean;
}

interface CampaignFormWizardProps {
  mode: "create" | "edit";
  title: string;
  subtitle: string;
  initialValues: CampaignFormValues;
  recipientsSource?: "contacts";
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  cancelHref: string;
  onSubmit: (input: CampaignFormSubmitInput) => Promise<void>;
}

function extractBodyVariables(template: MessageTemplate): string[] {
  const body = isSmsTemplate(template)
    ? template.body
    : template.components.find((c) => c.type === "BODY")?.text;
  if (!body) return [];
  const matches = body.match(/\{\{(\d+)\}\}/g) ?? [];
  return [...new Set(matches)].sort();
}

function buildComponents(
  template: MessageTemplate,
  variableValues: string[]
): CampaignRecipient["components"] {
  const vars = extractBodyVariables(template);
  if (vars.length === 0) return undefined;

  return [
    {
      type: "body",
      parameters: variableValues.map((v) => ({ type: "text", text: v })),
    },
  ];
}

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-1">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <p className="text-xs text-muted">{description}</p>
      </div>
    </div>
  );
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm font-medium text-primary sm:text-right">{children}</dd>
    </div>
  );
}

export function campaignFormValuesFromCampaign(
  campaign: {
    name: string;
    channel?: OutreachChannel;
    botId: string;
    templateName: string;
    language: string;
    segments: string[];
    scheduledAt?: string;
    batchConfig?: { size: number; delaySeconds: number };
    requireOptIn?: boolean;
    requestDlr?: boolean;
  },
  recipients: CampaignRecipient[]
): CampaignFormValues {
  const batchForm: BatchFormState = campaign.batchConfig
    ? {
        enabled: true,
        size: campaign.batchConfig.size,
        delayValue:
          campaign.batchConfig.delaySeconds >= 3600
            ? campaign.batchConfig.delaySeconds / 3600
            : campaign.batchConfig.delaySeconds / 60,
        delayUnit: campaign.batchConfig.delaySeconds >= 3600 ? "hours" : "minutes",
      }
    : DEFAULT_BATCH_FORM;

  return {
    config: {
      name: campaign.name,
      channel: campaign.channel ?? "whatsapp",
      botId: campaign.botId,
      templateName: campaign.templateName,
      language: campaign.language,
      segments: campaign.segments,
      scheduledAt: toDatetimeLocalValue(campaign.scheduledAt),
    },
    recipients,
    audienceTags: [],
    batchForm,
    requireOptIn: campaign.requireOptIn ?? false,
    requestDlr: campaign.requestDlr ?? false,
  };
}

export function CampaignFormWizard({
  mode,
  title,
  subtitle,
  initialValues,
  recipientsSource,
  isSubmitting,
  submitLabel,
  submittingLabel,
  cancelHref,
  onSubmit,
}: CampaignFormWizardProps) {
  const t = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("config");
  const [config, setConfig] = useState<CampaignConfigForm>(initialValues.config);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>(initialValues.recipients);
  const [audienceTags, setAudienceTags] = useState<string[]>(initialValues.audienceTags);
  const [batchForm, setBatchForm] = useState<BatchFormState>(initialValues.batchForm);
  const [requireOptIn, setRequireOptIn] = useState(initialValues.requireOptIn);
  const [requestDlr, setRequestDlr] = useState(initialValues.requestDlr);
  const [parseError, setParseError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [showStepHint, setShowStepHint] = useState(false);
  const [csvLoaded, setCsvLoaded] = useState(false);

  const { data: bots = [], isLoading: botsLoading } = useBots();
  const { data: templates = [] } = useTemplates(config.botId || undefined, config.channel);

  const availableAgents = listOutreachAgents(bots, config.channel);
  const configureAgentsHref = useMemo(() => {
    if (bots.length === 0) return "/bots/new";
    if (bots.length === 1) {
      const tab = config.channel === "sms" ? "sms" : "whatsapp";
      return `/bots/${bots[0].botId}/edit?tab=${tab}`;
    }
    return "/bots";
  }, [bots, config.channel]);
  const selectedAgent = availableAgents.find((b) => b.botId === config.botId);
  const selectedTemplate = templates.find(
    (template) => template.name === config.templateName && template.language === config.language
  );
  const approvedTemplates = templates.filter((template) => template.status === "APPROVED");
  const bodyVars = selectedTemplate ? extractBodyVariables(selectedTemplate) : [];
  const { assessment, phone, isLoading: qualityLoading } = useWhatsAppQualityGuard(
    config.botId,
    config.channel === "whatsapp"
  );

  const stepIndex = STEPS.indexOf(step);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;
  const batchError = validateBatchForm(batchForm);
  const estimatedAudience = Math.max(recipients.length, audienceTags.length ? 1 : 0);

  function canProceedConfig() {
    if (batchError) return false;
    return Boolean(
      config.name.trim() &&
        config.botId &&
        config.templateName &&
        config.language
    );
  }

  function canProceedRecipients() {
    return recipients.length > 0 || audienceTags.length > 0;
  }

  function configValidationMessage() {
    if (batchError) return t("campaigns.validationBatch");
    if (!canProceedConfig()) return t("campaigns.validationConfig");
    return null;
  }

  function recipientsValidationMessage() {
    if (!canProceedRecipients()) return t("campaigns.validationRecipients");
    return null;
  }

  function goToStep(target: Step) {
    const targetIndex = STEPS.indexOf(target);
    if (targetIndex < stepIndex) {
      setStep(target);
      setShowStepHint(false);
      return;
    }
    if (targetIndex === stepIndex) return;
    if (step === "config" && !canProceedConfig()) {
      setShowStepHint(true);
      return;
    }
    if (step === "recipients" && targetIndex > 1 && !canProceedRecipients()) {
      setShowStepHint(true);
      return;
    }
    if (targetIndex === stepIndex + 1) {
      setStep(target);
      setShowStepHint(false);
    }
  }

  function nextStep() {
    if (step === "config" && !canProceedConfig()) {
      setShowStepHint(true);
      return;
    }
    if (step === "recipients" && !canProceedRecipients()) {
      setShowStepHint(true);
      return;
    }
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1]);
      setShowStepHint(false);
    }
  }

  function prevStep() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) {
      setStep(STEPS[idx - 1]);
      setShowStepHint(false);
    }
  }

  async function processCsvFile(file: File) {
    setParseError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = decodeCsvBytes(bytes);
      const rows = parseRecipientsCsv(text);
      if (rows.length === 0) {
        setParseError(t("bulkSend.parseErrorEmpty"));
        return;
      }
      const built: CampaignRecipient[] = rows.map((row) => ({
        to: row.phone,
        ...(selectedTemplate && bodyVars.length > 0
          ? { components: buildComponents(selectedTemplate, row.variables) }
          : {}),
      }));
      setRecipients(built);
      setCsvLoaded(true);
    } catch {
      setParseError(t("bulkSend.parseErrorRead"));
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processCsvFile(file);
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setParseError(t("bulkSend.parseErrorRead"));
      return;
    }
    await processCsvFile(file);
  }

  async function handleSubmit() {
    if (!selectedTemplate) return;
    if (validateBatchForm(batchForm)) return;
    setSubmitError("");
    const batchConfig = batchFormToConfig(batchForm);
    try {
      await onSubmit({
        name: config.name.trim(),
        botId: config.botId,
        channel: config.channel,
        templateName: config.templateName,
        language: config.language,
        segments: config.segments,
        scheduledAt: config.scheduledAt
          ? new Date(config.scheduledAt).toISOString()
          : mode === "edit"
            ? null
            : undefined,
        ...(batchConfig ? { batchConfig } : {}),
        ...(recipients.length ? { recipients } : {}),
        ...(audienceTags.length ? { audienceTags } : {}),
        requireOptIn,
        ...(config.channel === "sms" && requestDlr ? { requestDlr: true } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("cannot receive marketing messages")) {
        setSubmitError(t("bulkSend.blockedRecipientsError"));
      } else {
        setSubmitError(
          message || (mode === "create" ? t("campaigns.createError") : t("campaigns.updateError"))
        );
      }
    }
  }

  function audienceSummary() {
    const hasCsv = recipients.length > 0;
    const hasTags = audienceTags.length > 0;
    if (hasCsv && hasTags) {
      return t("campaigns.audienceSourceMixed", {
        count: recipients.length,
        tags: audienceTags.join(", "),
      });
    }
    if (hasCsv) return t("campaigns.audienceSourceCsv", { count: recipients.length });
    if (hasTags) return t("campaigns.audienceSourceTags", { tags: audienceTags.join(", ") });
    return "—";
  }

  const stepValidationHint =
    step === "config"
      ? configValidationMessage()
      : step === "recipients"
        ? recipientsValidationMessage()
        : null;

  return (
    <DashboardPage className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted">
            {t("campaigns.stepProgress", {
              current: stepIndex + 1,
              total: STEPS.length,
            })}
          </p>
          <p className="hidden text-xs text-secondary sm:block">{t(`campaigns.stepHint.${step}`)}</p>
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
        >
          <div
            className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <nav aria-label={t("campaigns.newSubtitle")} className="flex flex-wrap items-center gap-2">
          {STEPS.map((s, i) => {
            const isActive = s === step;
            const isComplete = stepIndex > i;
            const isClickable = isComplete || i === stepIndex || i === stepIndex + 1;
            return (
              <Fragment key={s}>
                <button
                  type="button"
                  onClick={() => goToStep(s)}
                  disabled={!isClickable || isSubmitting}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    isActive && "bg-accent text-white shadow-sm",
                    isComplete && !isActive && "bg-accent-muted text-accent hover:bg-accent/15",
                    !isActive && !isComplete && "bg-surface-muted text-muted",
                    isClickable && !isActive && "cursor-pointer",
                    !isClickable && "cursor-default opacity-70"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                      isActive && "bg-white/20",
                      isComplete && !isActive && "bg-accent text-white",
                      !isActive && !isComplete && "bg-surface-elevated/60"
                    )}
                  >
                    {isComplete && !isActive ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {t(`campaigns.step.${s}`)}
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted sm:block" />
                )}
              </Fragment>
            );
          })}
        </nav>

        <p className="text-xs text-secondary sm:hidden">{t(`campaigns.stepHint.${step}`)}</p>
      </div>

      <div className="rounded-xl border border-default bg-surface-elevated p-5 sm:p-6">
        {step === "config" && (
          <div className="space-y-8">
            <section className="space-y-4">
              <SectionHeader
                icon={<MessageSquare className="h-4 w-4" />}
                title={t("campaigns.sectionBasics")}
                description={t("campaigns.sectionBasicsHint")}
              />

              <div className="space-y-4 sm:pl-12">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-secondary">
                    {t("campaigns.nameLabel")}
                  </label>
                  <Input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    placeholder={t("campaigns.namePlaceholder")}
                    maxLength={120}
                    autoFocus
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-secondary">
                      {t("outreach.channel")}
                    </label>
                    <OutreachChannelSelect
                      value={config.channel}
                      onChange={(channel) =>
                        setConfig({
                          ...config,
                          channel,
                          botId: "",
                          templateName: "",
                          language: "",
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-secondary">
                      {t("outreach.agent")}
                    </label>
                    <SelectControl
                      value={config.botId}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          botId: e.target.value,
                          templateName: "",
                          language: "",
                        })
                      }
                      disabled={botsLoading || availableAgents.length === 0}
                    >
                      <option value="">
                        {botsLoading ? t("common.loading") : t("outreach.selectAgent")}
                      </option>
                      {availableAgents.map((b) => (
                        <option key={b.botId} value={b.botId}>
                          {b.name}
                        </option>
                      ))}
                    </SelectControl>
                  </div>
                </div>

                {!botsLoading && availableAgents.length === 0 && (
                  <Alert
                    variant="warning"
                    title={
                      config.channel === "sms"
                        ? t("outreach.noAgentsSmsTitle")
                        : t("outreach.noAgentsWhatsappTitle")
                    }
                    className="sm:ml-0"
                  >
                    <p className="mb-3">
                      {config.channel === "sms"
                        ? t("outreach.noAgentsSmsHint")
                        : t("outreach.noAgentsWhatsappHint")}
                    </p>
                    <Link href={configureAgentsHref}>
                      <Button type="button" size="sm" variant="secondary">
                        {bots.length === 0
                          ? t("outreach.createAgentCta")
                          : t("outreach.configureChannelCta")}
                      </Button>
                    </Link>
                  </Alert>
                )}

                {config.botId && (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-secondary">
                      {t("bulkSend.template")}
                    </label>
                    <SelectControl
                      value={`${config.templateName}||${config.language}`}
                      onChange={(e) => {
                        const [name, lang] = e.target.value.split("||");
                        setConfig({ ...config, templateName: name, language: lang });
                      }}
                    >
                      <option value="||">{t("bulkSend.selectTemplate")}</option>
                      {approvedTemplates.map((tmpl) => (
                        <option
                          key={`${tmpl.name}-${tmpl.language}`}
                          value={`${tmpl.name}||${tmpl.language}`}
                        >
                          {tmpl.name} ({tmpl.language})
                        </option>
                      ))}
                    </SelectControl>
                    {bodyVars.length > 0 && (
                      <Alert variant="warning" className="mt-2 py-2.5">
                        {t("bulkSend.varsRequired", { vars: bodyVars.join(", ") })}
                      </Alert>
                    )}
                    {selectedTemplate && isSmsTemplate(selectedTemplate) && (
                      <SmsTemplatePreview
                        template={selectedTemplate}
                        label={t("bulkSend.preview")}
                        className="pt-2"
                      />
                    )}
                    {selectedTemplate && !isSmsTemplate(selectedTemplate) && (
                      <TemplateMessagePreview
                        template={selectedTemplate}
                        label={t("bulkSend.preview")}
                        className="pt-2"
                      />
                    )}
                  </div>
                )}
              </div>
            </section>

            <div className="border-t border-subtle" />

            <section className="space-y-4">
              <SectionHeader
                icon={<Tags className="h-4 w-4" />}
                title={t("campaigns.sectionOrganization")}
                description={t("campaigns.sectionOrganizationHint")}
              />
              <div className="space-y-1.5 sm:pl-12">
                <label className="block text-sm font-medium text-secondary">
                  {t("campaigns.segmentsLabel")}
                </label>
                <SegmentInput
                  value={config.segments}
                  onChange={(segs) => setConfig({ ...config, segments: segs })}
                />
                <div className="mt-1 flex flex-wrap gap-2">
                  {["lead", "converted"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (!config.segments.includes(preset)) {
                          setConfig({ ...config, segments: [...config.segments, preset] });
                        }
                      }}
                      className="rounded-md bg-surface-muted px-2 py-1 text-xs text-secondary transition-colors hover:bg-gray-200"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted">{t("campaigns.segmentsHint")}</p>
                <p className="text-xs text-muted">{t("campaigns.leadSegmentsHint")}</p>
              </div>
            </section>

            <div className="border-t border-subtle" />

            <section className="space-y-4">
              <SectionHeader
                icon={<CalendarClock className="h-4 w-4" />}
                title={t("campaigns.sectionDelivery")}
                description={t("campaigns.sectionDeliveryHint")}
              />
              <div className="space-y-4 sm:pl-12">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-secondary">
                    {t("campaigns.scheduledAtLabel")}
                  </label>
                  <Input
                    type="datetime-local"
                    value={config.scheduledAt}
                    onChange={(e) => setConfig({ ...config, scheduledAt: e.target.value })}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  />
                  <p className="text-xs text-muted">{t("campaigns.scheduledAtHint")}</p>
                </div>

                <CampaignBatchSettings
                  value={batchForm}
                  onChange={setBatchForm}
                  totalRecipients={estimatedAudience || undefined}
                />

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-default px-3 py-3 transition-colors hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={requireOptIn}
                    onChange={(e) => setRequireOptIn(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-default text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-secondary">
                    <span className="font-medium">{t("bulkSend.requireOptIn")}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {t("bulkSend.requireOptInHint")}
                    </span>
                  </span>
                </label>

                {config.channel === "sms" && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-default px-3 py-3 transition-colors hover:bg-surface">
                    <input
                      type="checkbox"
                      checked={requestDlr}
                      onChange={(e) => setRequestDlr(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-default text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-secondary">
                      <span className="font-medium">{t("campaigns.requestDlr")}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {t("campaigns.requestDlrHint")}
                      </span>
                    </span>
                  </label>
                )}
              </div>
            </section>
          </div>
        )}

        {step === "recipients" && (
          <div className="space-y-6">
            {recipientsSource === "contacts" && recipients.length > 0 && (
              <Alert variant="info">
                {recipients.length === 1
                  ? t("campaigns.fromContactsBanner", { count: recipients.length })
                  : t("campaigns.fromContactsBannerPlural", { count: recipients.length })}
              </Alert>
            )}

            <section className="space-y-3">
              <SectionHeader
                icon={<Users className="h-4 w-4" />}
                title={t("campaigns.sectionContacts")}
                description={t("campaigns.sectionContactsHint")}
              />
              <div className="sm:pl-12">
                <CampaignContactPicker
                  selectedPhones={recipients.map((r) => r.to)}
                  onChange={(phones) => {
                    setCsvLoaded(false);
                    setRecipients(phones.map((to) => ({ to })));
                  }}
                  requireOptIn={requireOptIn}
                />
              </div>
            </section>

            <div className="relative flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-surface-muted" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("campaigns.orDivider")}
              </span>
              <div className="h-px flex-1 bg-surface-muted" />
            </div>

            <section className="space-y-3">
              <SectionHeader
                icon={<Tags className="h-4 w-4" />}
                title={t("campaigns.sectionAudienceTags")}
                description={t("campaigns.audienceTagsHint")}
              />
              <div className="sm:pl-12">
                <SegmentInput
                  value={audienceTags}
                  onChange={setAudienceTags}
                  placeholder={t("campaigns.audienceTagsPlaceholder")}
                />
              </div>
            </section>

            <div className="relative flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-surface-muted" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("campaigns.orDivider")}
              </span>
              <div className="h-px flex-1 bg-surface-muted" />
            </div>

            <section className="space-y-3">
              <SectionHeader
                icon={<FileSpreadsheet className="h-4 w-4" />}
                title={t("campaigns.sectionCsv")}
                description={t("bulkSend.csvColumnHint")}
              />

              <div className="space-y-3 sm:pl-12">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                    dragOver
                      ? "border-accent bg-accent-muted/40"
                      : csvLoaded
                        ? "border-success/40 bg-[var(--alert-success-bg)]"
                        : "border-default hover:border-accent/50 hover:bg-surface"
                  )}
                >
                  {csvLoaded ? (
                    <>
                      <Check className="h-6 w-6 text-success" />
                      <p className="text-sm font-medium text-success">{t("campaigns.csvReady")}</p>
                      <p className="text-xs text-secondary">
                        {recipients.length === 1
                          ? t("bulkSend.recipients", { count: recipients.length })
                          : t("bulkSend.recipientsPlural", { count: recipients.length })}
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 text-muted" />
                      <p className="text-sm font-medium text-primary">{t("campaigns.csvDropzone")}</p>
                      <p className="text-xs text-muted">{t("campaigns.csvDropzoneHint")}</p>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t("bulkSend.selectCsv")}
                  </Button>
                  {csvLoaded && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRecipients([]);
                        setCsvLoaded(false);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      {t("common.delete")}
                    </Button>
                  )}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {parseError && <Alert variant="danger">{parseError}</Alert>}

                {csvLoaded && recipients.length > 0 && (
                  <TableContainer className="max-h-60 rounded-lg border border-default">
                    <table className="min-w-[320px] w-full text-xs">
                      <thead className="sticky top-0 bg-surface">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-secondary">
                            {t("bulkSend.colPhone")}
                          </th>
                          {bodyVars.map((v) => (
                            <th key={v} className="px-3 py-2 text-left font-medium text-secondary">
                              {v}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {recipients.slice(0, 50).map((r, i) => (
                          <tr key={i} className="hover:bg-surface">
                            <td className="px-3 py-2 font-mono text-secondary">{r.to}</td>
                            {(r.components?.[0]?.parameters ?? []).map((p, pi) => (
                              <td key={pi} className="px-3 py-2 text-secondary">
                                {p.text ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {recipients.length > 50 && (
                      <div className="border-t border-subtle bg-surface px-3 py-2 text-xs text-muted">
                        {t("bulkSend.showingRows", { total: recipients.length })}
                      </div>
                    )}
                  </TableContainer>
                )}
              </div>
            </section>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-5">
            <SectionHeader
              icon={<Check className="h-4 w-4" />}
              title={t("campaigns.reviewTitle")}
              description={t("campaigns.stepHint.review")}
            />

            <dl className="divide-y divide-subtle rounded-xl border border-default bg-surface px-4 py-1 sm:pl-12">
              <div className="py-3">
                <ReviewRow label={t("campaigns.nameLabel")}>{config.name}</ReviewRow>
              </div>
              <div className="py-3">
                <ReviewRow label={t("outreach.channel")}>
                  {config.channel === "sms"
                    ? t("outreach.channelSms")
                    : t("outreach.channelWhatsapp")}
                </ReviewRow>
              </div>
              <div className="py-3">
                <ReviewRow label={t("outreach.agent")}>{selectedAgent?.name}</ReviewRow>
              </div>
              <div className="py-3">
                <ReviewRow label={t("bulkSend.template")}>
                  {config.templateName} ({config.language})
                </ReviewRow>
              </div>
              <div className="py-3">
                <ReviewRow label={t("common.total")}>{audienceSummary()}</ReviewRow>
              </div>
              {config.segments.length > 0 && (
                <div className="py-3">
                  <ReviewRow label={t("campaigns.segmentsLabel")}>
                    {config.segments.join(", ")}
                  </ReviewRow>
                </div>
              )}
              <div className="py-3">
                <ReviewRow label={t("campaigns.scheduledAtLabel")}>
                  {config.scheduledAt
                    ? new Date(config.scheduledAt).toLocaleString()
                    : t("campaigns.sendNow")}
                </ReviewRow>
              </div>
              {batchForm.enabled && batchFormToConfig(batchForm) && (
                <div className="py-3">
                  <ReviewRow label={t("campaigns.batch.summaryLabel")}>
                    {t("campaigns.batch.summaryValue", {
                      size: batchForm.size,
                      delay: formatBatchDelay(batchFormToConfig(batchForm)!.delaySeconds, t),
                      batches: estimateBatchCount(estimatedAudience, batchForm.size),
                    })}
                  </ReviewRow>
                </div>
              )}
              <div className="py-3">
                <ReviewRow label={t("bulkSend.requireOptIn")}>
                  {requireOptIn
                    ? t("campaigns.requireOptInStatusOn")
                    : t("campaigns.requireOptInStatusOff")}
                </ReviewRow>
              </div>
              {config.channel === "sms" && (
                <div className="py-3">
                  <ReviewRow label={t("campaigns.requestDlr")}>
                    {requestDlr
                      ? t("campaigns.requestDlrStatusOn")
                      : t("campaigns.requestDlrStatusOff")}
                  </ReviewRow>
                </div>
              )}
            </dl>

            {config.channel === "whatsapp" && config.botId && (
              <CampaignQualityAlert
                phone={phone}
                assessment={assessment}
                isLoading={qualityLoading}
              />
            )}

            {selectedTemplate && isSmsTemplate(selectedTemplate) && (
              <SmsTemplatePreview
                template={selectedTemplate}
                label={t("bulkSend.preview")}
                variableValues={
                  recipients[0]?.components?.[0]?.parameters?.map((p) => p.text ?? "") ?? undefined
                }
              />
            )}

            {selectedTemplate && !isSmsTemplate(selectedTemplate) && (
              <TemplateMessagePreview
                template={selectedTemplate}
                label={t("bulkSend.preview")}
                variableValues={
                  recipients[0]?.components?.[0]?.parameters?.map((p) => p.text ?? "") ?? undefined
                }
              />
            )}

            {submitError && <Alert variant="danger">{submitError}</Alert>}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-subtle bg-surface/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={isFirstStep ? () => router.push(cancelHref) : prevStep}
            disabled={isSubmitting}
          >
            <ChevronLeft className="h-4 w-4" />
            {isFirstStep ? t("common.cancel") : t("campaigns.back")}
          </Button>

          <div className="flex flex-col items-end gap-1.5">
            {showStepHint && stepValidationHint && (
              <p className="max-w-[16rem] text-right text-xs text-warning sm:max-w-none">
                {stepValidationHint}
              </p>
            )}
            {isLastStep ? (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? submittingLabel : submitLabel}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={nextStep}
                disabled={isSubmitting}
                className={cn(
                  ((step === "config" && !canProceedConfig()) ||
                    (step === "recipients" && !canProceedRecipients())) &&
                    "opacity-60"
                )}
              >
                {t("campaigns.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
