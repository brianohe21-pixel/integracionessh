"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Upload, X } from "lucide-react";
import { useT } from "@/i18n/context";
import { useBots } from "@/hooks/useBots";
import { useTemplates } from "@/hooks/useTemplates";
import { useCreateCampaign, type CampaignRecipient } from "@/hooks/useCampaigns";
import { SegmentInput } from "@/components/campaigns/SegmentInput";
import { parseRecipientsCsv, decodeCsvBytes } from "@/lib/csv";
import type { WhatsAppTemplate } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

type Step = "config" | "recipients" | "review";

const STEPS: Step[] = ["config", "recipients", "review"];

function extractBodyVariables(template: WhatsAppTemplate): string[] {
  const body = template.components.find((c) => c.type === "BODY");
  if (!body?.text) return [];
  const matches = body.text.match(/\{\{(\d+)\}\}/g) ?? [];
  return [...new Set(matches)].sort();
}

function buildComponents(
  template: WhatsAppTemplate,
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
    botId: "",
    templateName: "",
    language: "",
    segments: [],
    scheduledAt: "",
  });
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [audienceTags, setAudienceTags] = useState<string[]>([]);
  const [parseError, setParseError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const { data: bots = [] } = useBots();
  const { data: templates = [] } = useTemplates(config.botId || undefined);

  const selectedBot = bots.find((b) => b.botId === config.botId);
  const selectedTemplate = templates.find(
    (t) => t.name === config.templateName && t.language === config.language
  );
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED");
  const bodyVars = selectedTemplate ? extractBodyVariables(selectedTemplate) : [];

  const stepIndex = STEPS.indexOf(step);
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  function canProceedConfig() {
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
    setSubmitError("");
    try {
      const campaign = await createCampaign.mutateAsync({
        name: config.name.trim(),
        botId: config.botId,
        templateName: config.templateName,
        language: config.language,
        segments: config.segments,
        ...(config.scheduledAt ? { scheduledAt: new Date(config.scheduledAt).toISOString() } : {}),
        ...(recipients.length ? { recipients } : {}),
        ...(audienceTags.length ? { audienceTags } : {}),
      });
      router.push(`/campaigns/${campaign.campaignId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t("campaigns.createError"));
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
                  ? "bg-indigo-600 text-white"
                  : stepIndex > i
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
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

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {step === "config" && (
          <>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">{t("campaigns.nameLabel")}</label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder={t("campaigns.namePlaceholder")}
                maxLength={120}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">{t("bulkSend.bot")}</label>
              <select
                value={config.botId}
                onChange={(e) =>
                  setConfig({ ...config, botId: e.target.value, templateName: "", language: "" })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="">{t("bulkSend.selectBot")}</option>
                {bots.map((b) => (
                  <option key={b.botId} value={b.botId}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {config.botId && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">{t("bulkSend.template")}</label>
                <select
                  value={`${config.templateName}||${config.language}`}
                  onChange={(e) => {
                    const [name, lang] = e.target.value.split("||");
                    setConfig({ ...config, templateName: name, language: lang });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
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
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">{t("campaigns.segmentsLabel")}</label>
              <SegmentInput
                value={config.segments}
                onChange={(segs) => setConfig({ ...config, segments: segs })}
              />
              <p className="text-xs text-gray-400">{t("campaigns.segmentsHint")}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">{t("campaigns.scheduledAtLabel")}</label>
              <input
                type="datetime-local"
                value={config.scheduledAt}
                onChange={(e) => setConfig({ ...config, scheduledAt: e.target.value })}
                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-xs text-gray-400">{t("campaigns.scheduledAtHint")}</p>
            </div>
          </>
        )}

        {step === "recipients" && (
          <>
            <div className="space-y-3 pb-4 border-b border-gray-100">
              <label className="block text-sm font-medium text-gray-700">{t("campaigns.audienceTagsLabel")}</label>
              <p className="text-xs text-gray-500">{t("campaigns.audienceTagsHint")}</p>
              <SegmentInput
                value={audienceTags}
                onChange={setAudienceTags}
                placeholder={t("campaigns.audienceTagsPlaceholder")}
              />
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t("bulkSend.csvFile")}</label>
                <p className="text-xs text-gray-500 mt-0.5">{t("campaigns.recipientsOrTags")}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t("bulkSend.csvColumnHint")}</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
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
                <TableContainer className="rounded-lg border border-gray-200 max-h-60">
                  <table className="min-w-[320px] w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">{t("bulkSend.colPhone")}</th>
                        {bodyVars.map((v) => (
                          <th key={v} className="px-3 py-2 text-left text-gray-500 font-medium">
                            {v}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recipients.slice(0, 50).map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700 font-mono">{r.to}</td>
                          {(r.components?.[0]?.parameters ?? []).map((p, pi) => (
                            <td key={pi} className="px-3 py-2 text-gray-600">
                              {p.text ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {recipients.length > 50 && (
                    <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
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
            <h3 className="font-medium text-gray-900">{t("campaigns.reviewTitle")}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-gray-500">{t("campaigns.nameLabel")}</dt>
              <dd className="font-medium text-gray-900">{config.name}</dd>
              <dt className="text-gray-500">{t("bulkSend.bot")}</dt>
              <dd className="font-medium text-gray-900">{selectedBot?.name}</dd>
              <dt className="text-gray-500">{t("bulkSend.template")}</dt>
              <dd className="font-medium text-gray-900">
                {config.templateName} ({config.language})
              </dd>
              <dt className="text-gray-500">{t("common.total")}</dt>
              <dd className="font-medium text-gray-900">{recipients.length}</dd>
              {config.segments.length > 0 && (
                <>
                  <dt className="text-gray-500">{t("campaigns.segmentsLabel")}</dt>
                  <dd className="font-medium text-gray-900">{config.segments.join(", ")}</dd>
                </>
              )}
              {config.scheduledAt && (
                <>
                  <dt className="text-gray-500">{t("campaigns.scheduledAtLabel")}</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(config.scheduledAt).toLocaleString()}
                  </dd>
                </>
              )}
            </dl>

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
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {isFirstStep ? t("common.cancel") : t("campaigns.back")}
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createCampaign.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors text-sm font-medium"
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors text-sm font-medium"
          >
            {t("campaigns.next")}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </DashboardPage>
  );
}
