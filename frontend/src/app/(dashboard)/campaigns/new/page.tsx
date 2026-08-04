"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Upload, X } from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useTemplates } from "@/hooks/useTemplates";
import { useCreateCampaign, type CampaignRecipient } from "@/hooks/useCampaigns";
import { SegmentInput } from "@/components/campaigns/SegmentInput";
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
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

type Step = "config" | "recipients" | "review";

const STEPS: Step[] = ["config", "recipients", "review"];

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

interface ConfigForm {
  name: string;
  channel: OutreachChannel;
  botId: string;
  templateName: string;
  language: string;
  segments: string[];
  scheduledAt: string;
}

export default function NewCampaignPage() {
  const t = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const createCampaign = useCreateCampaign();

  const [step, setStep] = useState<Step>("config");
  const [config, setConfig] = useState<ConfigForm>({
    name: "",
    channel: "whatsapp",
    botId: "",
    templateName: "",
    language: "",
    segments: [],
    scheduledAt: "",
  });
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [audienceTags, setAudienceTags] = useState<string[]>([]);
  const [batchForm, setBatchForm] = useState<BatchFormState>(DEFAULT_BATCH_FORM);
  const [requireOptIn, setRequireOptIn] = useState(false);
  const [parseError, setParseError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const { data: bots = [] } = useBots();
  const { data: templates = [] } = useTemplates(config.botId || undefined, config.channel);

  const availableBots =
    config.channel === "sms" ? bots.filter((bot) => bot.smsEnabled) : bots;
  const selectedBot = availableBots.find((b) => b.botId === config.botId);
  const selectedTemplate = templates.find(
    (t) => t.name === config.templateName && t.language === config.language
  );
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");
  const bodyVars = selectedTemplate ? extractBodyVariables(selectedTemplate) : [];
  const { assessment, phone, isLoading: qualityLoading } = useWhatsAppQualityGuard(
    config.channel === "whatsapp" ? config.botId : ""
  );

  const stepIndex = STEPS.indexOf(step);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  function canProceedConfig() {
    if (validateBatchForm(batchForm)) return false;
    return (
      config.name.trim() &&
      config.botId &&
      config.templateName &&
      config.language
    );
  }

  function canProceedRecipients() {
    return recipients.length > 0 || audienceTags.length > 0;
  }

  function nextStep() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function prevStep() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
    } catch {
      setParseError(t("bulkSend.parseErrorRead"));
    }
  }

  async function handleSubmit() {
    if (!selectedTemplate) return;
    if (validateBatchForm(batchForm)) return;
    setSubmitError("");
    const batchConfig = batchFormToConfig(batchForm);
    try {
      const campaign = await createCampaign.mutateAsync({
        name: config.name.trim(),
        botId: config.botId,
        channel: config.channel,
        templateName: config.templateName,
        language: config.language,
        segments: config.segments,
        ...(config.scheduledAt ? { scheduledAt: new Date(config.scheduledAt).toISOString() } : {}),
        ...(batchConfig ? { batchConfig } : {}),
        ...(recipients.length ? { recipients } : {}),
        ...(audienceTags.length ? { audienceTags } : {}),
        requireOptIn,
      });
      router.push(`/campaigns/${campaign.campaignId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("cannot receive marketing messages")) {
        setSubmitError(t("bulkSend.blockedRecipientsError"));
      } else {
        setSubmitError(message || t("campaigns.createError"));
      }
    }
  }

  return (
    <DashboardPage maxWidth="3xl" className="space-y-6">
      <PageHeader
        title={t("campaigns.newTitle")}
        subtitle={t("campaigns.newSubtitle")}
      />

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <Fragment key={s}>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                s === step
                  ? "bg-accent text-white"
                  : stepIndex > i
                  ? "bg-accent-muted text-accent"
                  : "bg-surface-muted text-muted"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-surface-elevated/20 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              {t(`campaigns.step.${s}`)}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            )}
          </Fragment>
        ))}
      </div>

      <div className="bg-surface-elevated rounded-xl border border-default p-6 space-y-5">
        {step === "config" && (
          <>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-secondary">{t("campaigns.nameLabel")}</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder={t("campaigns.namePlaceholder")}
                maxLength={120}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/30"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-secondary">{t("outreach.channel")}</label>
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
              <label className="block text-sm font-medium text-secondary">{t("bulkSend.bot")}</label>
              <select
                value={config.botId}
                onChange={(e) =>
                  setConfig({ ...config, botId: e.target.value, templateName: "", language: "" })
                }
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/30 bg-surface-elevated"
              >
                <option value="">{t("bulkSend.selectBot")}</option>
                {availableBots.map((b) => (
                  <option key={b.botId} value={b.botId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {config.botId && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-secondary">{t("bulkSend.template")}</label>
                <select
                  value={`${config.templateName}||${config.language}`}
                  onChange={(e) => {
                    const [name, lang] = e.target.value.split("||");
                    setConfig({ ...config, templateName: name, language: lang });
                  }}
                  className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/30 bg-surface-elevated"
                >
                  <option value="||">{t("bulkSend.selectTemplate")}</option>
                  {approvedTemplates.map((tmpl) => (
                    <option key={`${tmpl.name}-${tmpl.language}`} value={`${tmpl.name}||${tmpl.language}`}>
                      {tmpl.name} ({tmpl.language})
                    </option>
                  ))}
                </select>
                {bodyVars.length > 0 && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                    {t("bulkSend.varsRequired", { vars: bodyVars.join(", ") })}
                  </p>
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

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-secondary">{t("campaigns.segmentsLabel")}</label>
              <SegmentInput
                value={config.segments}
                onChange={(segs) => setConfig({ ...config, segments: segs })}
              />
              <div className="flex flex-wrap gap-2 mt-1">
                {["lead", "converted"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      if (!config.segments.includes(preset)) {
                        setConfig({ ...config, segments: [...config.segments, preset] });
                      }
                    }}
                    className="text-xs px-2 py-1 bg-surface-muted text-secondary rounded hover:bg-gray-200"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">{t("campaigns.segmentsHint")}</p>
              <p className="text-xs text-muted">{t("campaigns.leadSegmentsHint")}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-secondary">{t("campaigns.scheduledAtLabel")}</label>
              <input
                type="datetime-local"
                value={config.scheduledAt}
                onChange={(e) => setConfig({ ...config, scheduledAt: e.target.value })}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/30"
              />
              <p className="text-xs text-muted">{t("campaigns.scheduledAtHint")}</p>
            </div>

            <CampaignBatchSettings
              value={batchForm}
              onChange={setBatchForm}
              totalRecipients={recipients.length || undefined}
            />

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireOptIn}
                onChange={(e) => setRequireOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-default text-accent focus:ring-accent"
              />
              <span className="text-sm text-secondary">
                <span className="font-medium">{t("bulkSend.requireOptIn")}</span>
                <span className="block text-xs text-secondary mt-0.5">{t("bulkSend.requireOptInHint")}</span>
              </span>
            </label>
          </>
        )}

        {step === "recipients" && (
          <>
            <div className="space-y-3 pb-4 border-b border-subtle">
              <label className="block text-sm font-medium text-secondary">{t("campaigns.audienceTagsLabel")}</label>
              <p className="text-xs text-secondary">{t("campaigns.audienceTagsHint")}</p>
              <SegmentInput
                value={audienceTags}
                onChange={setAudienceTags}
                placeholder={t("campaigns.audienceTagsPlaceholder")}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-secondary">{t("bulkSend.csvFile")}</label>
                <p className="text-xs text-secondary mt-0.5">{t("campaigns.recipientsOrTags")}</p>
                <p className="text-xs text-secondary mt-0.5">{t("bulkSend.csvColumnHint")}</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-default rounded-lg text-sm font-medium text-secondary hover:bg-surface transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {t("bulkSend.selectCsv")}
                </button>
                {recipients.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecipients([]);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-default rounded-lg text-sm text-secondary hover:bg-surface transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t("common.delete")}
                  </button>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />

              {parseError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{parseError}</p>
              )}

              {recipients.length > 0 && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
                  {recipients.length === 1
                    ? t("bulkSend.recipients", { count: recipients.length })
                    : t("bulkSend.recipientsPlural", { count: recipients.length })}
                </div>
              )}

              {recipients.length > 0 && (
                <TableContainer className="rounded-lg border border-default max-h-60">
                  <table className="min-w-[320px] w-full text-xs">
                    <thead className="bg-surface sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-secondary font-medium">{t("bulkSend.colPhone")}</th>
                        {bodyVars.map((v) => (
                          <th key={v} className="px-3 py-2 text-left text-secondary font-medium">
                            {v}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recipients.slice(0, 50).map((r, i) => (
                        <tr key={i} className="hover:bg-surface">
                          <td className="px-3 py-2 text-secondary font-mono">{r.to}</td>
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
                    <div className="px-3 py-2 text-xs text-muted bg-surface border-t border-subtle">
                      {t("bulkSend.showingRows", { total: recipients.length })}
                    </div>
                  )}
                </TableContainer>
              )}
            </div>
          </>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <h3 className="font-medium text-primary">{t("campaigns.reviewTitle")}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-secondary">{t("campaigns.nameLabel")}</dt>
              <dd className="font-medium text-primary">{config.name}</dd>
              <dt className="text-secondary">{t("outreach.channel")}</dt>
              <dd className="font-medium text-primary">
                {config.channel === "sms" ? t("outreach.channelSms") : t("outreach.channelWhatsapp")}
              </dd>
              <dt className="text-secondary">{t("bulkSend.bot")}</dt>
              <dd className="font-medium text-primary">{selectedBot?.name}</dd>
              <dt className="text-secondary">{t("bulkSend.template")}</dt>
              <dd className="font-medium text-primary">
                {config.templateName} ({config.language})
              </dd>
              <dt className="text-secondary">{t("common.total")}</dt>
              <dd className="font-medium text-primary">{recipients.length}</dd>
              {config.segments.length > 0 && (
                <>
                  <dt className="text-secondary">{t("campaigns.segmentsLabel")}</dt>
                  <dd className="font-medium text-primary">{config.segments.join(", ")}</dd>
                </>
              )}
              {config.scheduledAt && (
                <>
                  <dt className="text-secondary">{t("campaigns.scheduledAtLabel")}</dt>
                  <dd className="font-medium text-primary">
                    {new Date(config.scheduledAt).toLocaleString()}
                  </dd>
                </>
              )}
              {batchForm.enabled && batchFormToConfig(batchForm) && (
                <>
                  <dt className="text-secondary">{t("campaigns.batch.summaryLabel")}</dt>
                  <dd className="font-medium text-primary">
                    {t("campaigns.batch.summaryValue", {
                      size: batchForm.size,
                      delay: formatBatchDelay(batchFormToConfig(batchForm)!.delaySeconds, t),
                      batches: estimateBatchCount(
                        Math.max(recipients.length, audienceTags.length ? 1 : 0),
                        batchForm.size
                      ),
                    })}
                  </dd>
                </>
              )}
              <dt className="text-secondary">{t("bulkSend.requireOptIn")}</dt>
              <dd className="font-medium text-primary">
                {requireOptIn ? t("campaigns.requireOptInStatusOn") : t("campaigns.requireOptInStatusOff")}
              </dd>
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

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{submitError}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={isFirstStep ? () => router.push("/campaigns") : prevStep}
          disabled={createCampaign.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 border border-default rounded-lg text-sm font-medium text-secondary hover:bg-surface disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {isFirstStep ? t("common.cancel") : t("campaigns.back")}
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createCampaign.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-60 transition-colors text-sm font-medium"
          >
            {createCampaign.isPending ? t("campaigns.creating") : t("campaigns.createBtn")}
          </button>
        ) : (
          <button
            type="button"
            onClick={nextStep}
            disabled={
              (step === "config" && !canProceedConfig()) ||
              (step === "recipients" && !canProceedRecipients())
            }
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-40 transition-colors text-sm font-medium"
          >
            {t("campaigns.next")}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </DashboardPage>
  );
}
