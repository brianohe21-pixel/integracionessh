"use client";

import { Fragment, useRef, useState } from "react";
import { useBots } from "@/hooks/useBots";
import { useTemplates } from "@/hooks/useTemplates";
import { useBulkSend, useBulkHistory, type BulkRecipient, type BulkSendJob } from "@/hooks/useBulkSend";
import { BulkJobFailures } from "@/components/bulk-send/BulkJobFailures";
import { Badge } from "@/components/ui/Badge";
import { useFormatters } from "@/hooks/useFormatters";
import { useT, useLocale } from "@/i18n/context";
import { buildCsv, decodeCsvBytes, downloadCsvFile, parseRecipientsCsv } from "@/lib/csv";
import { downloadBulkHistoryCsv, downloadBulkJobFailuresCsv } from "@/lib/bulk-send-csv";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WhatsAppTemplate } from "@/types";
import {
  SendHorizonal,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Download,
  History,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

function extractBodyVariables(text: string): string[] {
  const matches = text.match(/\{\{\d+\}\}/g);
  return matches ? [...new Set(matches)] : [];
}

function buildComponents(
  varKeys: string[],
  values: string[]
): BulkRecipient["components"] | undefined {
  if (varKeys.length === 0) return undefined;
  return [
    {
      type: "body",
      parameters: varKeys.map((_, i) => ({
        type: "text" as const,
        text: values[i] ?? "",
      })),
    },
  ];
}

type Tab = "send" | "history";

export default function BulkSendPage() {
  const t = useT();
  const locale = useLocale();
  const { formatDate } = useFormatters();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("send");
  const [botId, setBotId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [csvRows, setCsvRows] = useState<ReturnType<typeof parseRecipientsCsv>>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0, failed: 0, deliveryFailed: 0 });
  const [result, setResult] = useState<{ sent: number; failed: number; deliveryFailed: number } | null>(null);
  const [lastCompletedJobId, setLastCompletedJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  const { data: bots } = useBots();
  const { data: templates, isLoading: loadingTemplates } = useTemplates(botId || undefined);
  const bulkMutation = useBulkSend();
  const { data: history, isLoading: loadingHistory, refetch: refetchHistory } = useBulkHistory();

  const approvedTemplates = templates?.filter((t) => t.status === "APPROVED") ?? [];
  const selectedTemplate: WhatsAppTemplate | undefined = approvedTemplates.find(
    (t) => t.name === templateName
  );
  const bodyVars = selectedTemplate
    ? extractBodyVariables(
        selectedTemplate.components.find((c) => c.type === "BODY")?.text ?? ""
      )
    : [];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError("");
    setResult(null);
    setFileName(file.name);

    void file.arrayBuffer().then((buffer) => {
      const text = decodeCsvBytes(new Uint8Array(buffer));
      const rows = parseRecipientsCsv(text);
      if (rows.length === 0) {
        setParseError(t("bulkSend.parseErrorEmpty"));
        setCsvRows([]);
        return;
      }
      setCsvRows(rows);
    }).catch(() => {
      setParseError(t("bulkSend.parseErrorRead"));
      setCsvRows([]);
    });
  }

  function downloadSample() {
    const headers = ["phone", ...bodyVars.map((_, i) => `var${i + 1}`)];
    const rows = [["573001234567", ...bodyVars.map(() => t("common.example"))]];
    downloadCsvFile("plantilla_envio_masivo.csv", buildCsv(headers, rows));
  }

  async function handleDownloadJobCsv(job: BulkSendJob) {
    setDownloadingJobId(job.jobId);
    try {
      await downloadBulkJobFailuresCsv(job);
    } finally {
      setDownloadingJobId(null);
    }
  }

  async function handleBulkSend() {
    if (!selectedTemplate || !botId || csvRows.length === 0) return;

    setResult(null);
    setProgress({ current: 0, total: csvRows.length, failed: 0, deliveryFailed: 0 });

    const recipients: BulkRecipient[] = csvRows.map((row) => ({
      to: row.phone,
      components: buildComponents(bodyVars, row.variables),
    }));

    const res = await bulkMutation.mutateAsync({
      botId,
      templateName: selectedTemplate.name,
      language: selectedTemplate.language,
      recipients,
      onProgress: (job) =>
        setProgress({
          current: job.sent + job.failed,
          total: job.total,
          failed: job.failed,
          deliveryFailed: job.deliveryFailed ?? 0,
        }),
    });

    setResult({ sent: res.sent, failed: res.failed, deliveryFailed: res.deliveryFailed });
    setLastCompletedJobId(res.jobId);
    if (res.failed > 0 || res.deliveryFailed > 0) {
      setExpandedJobId(res.jobId);
    }
    setTab("history");
  }

  const isSending = bulkMutation.isPending;
  const canSend = !!botId && !!templateName && csvRows.length > 0 && !isSending;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "send", label: t("bulkSend.tabSend"), icon: <SendHorizonal className="w-4 h-4" /> },
    { id: "history", label: t("bulkSend.tabHistory"), icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t("bulkSend.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("bulkSend.subtitle")}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === tabItem.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tabItem.icon}
            {tabItem.label}
          </button>
        ))}
      </div>

      {tab === "send" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">{t("bulkSend.config")}</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("bulkSend.bot")}</label>
                <select
                  value={botId}
                  onChange={(e) => {
                    setBotId(e.target.value);
                    setTemplateName("");
                    setCsvRows([]);
                    setFileName("");
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t("bulkSend.selectBot")}</option>
                  {bots?.map((bot) => (
                    <option key={bot.botId} value={bot.botId}>
                      {bot.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("bulkSend.template")}</label>
                <select
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  disabled={!botId || loadingTemplates}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">{t("bulkSend.selectTemplate")}</option>
                  {approvedTemplates.map((tpl) => (
                    <option key={`${tpl.name}-${tpl.language}`} value={tpl.name}>
                      {tpl.name} ({tpl.language})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate && bodyVars.length > 0 && (
                <p className="text-xs text-gray-500">
                  {t("bulkSend.varsRequired", { vars: bodyVars.join(", ") })}
                </p>
              )}

              {selectedTemplate && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t("bulkSend.preview")}</p>
                  <div className="bg-[#e5ddd5] rounded-xl p-4">
                    <div className="max-w-xs ml-auto">
                      <div className="bg-white rounded-2xl rounded-tr-sm shadow-sm overflow-hidden">
                        {selectedTemplate.components.find((c) => c.type === "HEADER")?.text && (
                          <div className="px-3 pt-3 pb-1">
                            <p className="text-sm font-semibold text-gray-900 leading-snug">
                              {selectedTemplate.components.find((c) => c.type === "HEADER")!.text}
                            </p>
                          </div>
                        )}
                        {selectedTemplate.components.find((c) => c.type === "BODY")?.text && (
                          <div className="px-3 py-2">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                              {selectedTemplate.components
                                .find((c) => c.type === "BODY")!
                                .text!.replace(/\{\{(\d+)\}\}/g, (_: string, n: string) => `{{var${n}}}`)}
                            </p>
                          </div>
                        )}
                        {selectedTemplate.components.find((c) => c.type === "FOOTER")?.text && (
                          <div className="px-3 pb-2">
                            <p className="text-xs text-gray-400 leading-snug">
                              {selectedTemplate.components.find((c) => c.type === "FOOTER")!.text}
                            </p>
                          </div>
                        )}
                        {selectedTemplate.components.find((c) => c.type === "BUTTONS") && (
                          <div className="border-t border-gray-100">
                            {selectedTemplate.components
                              .find((c) => c.type === "BUTTONS")!
                              .buttons?.map((btn, i) => (
                                <div
                                  key={i}
                                  className="px-3 py-2 text-center text-xs font-medium text-indigo-600 border-t border-gray-100 first:border-t-0"
                                >
                                  {btn.text}
                                </div>
                              ))}
                          </div>
                        )}
                        <div className="flex justify-end px-3 pb-2">
                          <span className="text-[10px] text-gray-400">
                            {new Date().toLocaleTimeString(locale === "en" ? "en-US" : "es-CO", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">{t("bulkSend.csvFile")}</h2>
                {selectedTemplate && (
                  <button
                    type="button"
                    onClick={downloadSample}
                    className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t("bulkSend.downloadSample")}
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!botId || !templateName}
                className="flex flex-col items-center justify-center w-full py-10 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700">
                  {fileName || t("bulkSend.selectCsv")}
                </span>
                <span className="text-xs text-gray-400 mt-1">{t("bulkSend.csvColumnHint")}</span>
              </button>

              {parseError && (
                <p className="text-sm text-red-600">{parseError}</p>
              )}
            </div>
          </div>

          {!botId && (
            <EmptyState
              icon={<SendHorizonal className="w-6 h-6" />}
              title={t("bulkSend.selectBotTitle")}
              description={t("bulkSend.selectBotDescription")}
            />
          )}

          {botId && csvRows.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {csvRows.length === 1
                      ? t("bulkSend.recipients", { count: csvRows.length })
                      : t("bulkSend.recipientsPlural", { count: csvRows.length })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleBulkSend}
                  disabled={!canSend}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SendHorizonal className="w-4 h-4" />
                  {isSending ? t("bulkSend.sending") : t("bulkSend.startSend")}
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-2">
                        {t("bulkSend.colPhone")}
                      </th>
                      {bodyVars.map((v) => (
                        <th
                          key={v}
                          className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-2"
                        >
                          {v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {csvRows.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-5 py-2 text-sm text-gray-900">{row.phone}</td>
                        {bodyVars.map((_, vi) => (
                          <td key={vi} className="px-5 py-2 text-sm text-gray-600">
                            {row.variables[vi] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvRows.length > 50 && (
                  <p className="text-xs text-gray-400 px-5 py-2 border-t border-gray-100">
                    {t("bulkSend.showingRows", { total: csvRows.length })}
                  </p>
                )}
              </div>
            </div>
          )}

          {isSending && progress.total > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{t("bulkSend.progress")}</span>
                <span className="text-sm text-gray-500">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <div className="flex gap-4 mt-2">
                {progress.failed > 0 && (
                  <p className="text-xs text-red-600">{t("bulkSend.rejectedMeta", { count: progress.failed })}</p>
                )}
                {progress.deliveryFailed > 0 && (
                  <p className="text-xs text-orange-600">{t("bulkSend.deliveryFailed", { count: progress.deliveryFailed })}</p>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("bulkSend.acceptedMeta", { count: result.sent })}</span>
                </div>
                {result.failed > 0 && (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{t("bulkSend.rejectedMeta", { count: result.failed })}</span>
                  </div>
                )}
                {result.deliveryFailed > 0 && (
                  <div className="flex items-center gap-2 text-orange-600">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{t("bulkSend.deliveryFailed", { count: result.deliveryFailed })}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 border-t border-gray-100 pt-3">{t("bulkSend.resultHint")}</p>
              {(result.failed > 0 || result.deliveryFailed > 0) && lastCompletedJobId && (
                <BulkJobFailures
                  jobId={lastCompletedJobId}
                  templateName={selectedTemplate?.name ?? "campana"}
                />
              )}
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
            <span className="text-sm font-semibold text-gray-900">{t("bulkSend.historyTitle")}</span>
            <div className="flex items-center gap-3">
              {history && history.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadBulkHistoryCsv(history)}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t("bulkSend.downloadHistory")}
                </button>
              )}
              <button
                type="button"
                onClick={() => void refetchHistory()}
                disabled={loadingHistory}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
                {t("common.refresh")}
              </button>
            </div>
          </div>

          {loadingHistory && (
            <div className="divide-y divide-gray-100">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-5 py-4 animate-pulse flex items-center gap-4">
                  <div className="h-3 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-20 bg-gray-200 rounded" />
                  <div className="flex-1" />
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          )}

          {!loadingHistory && (!history || history.length === 0) && (
            <div className="px-5 py-16 text-center">
              <History className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">{t("bulkSend.noHistory")}</p>
            </div>
          )}

          {!loadingHistory && history && history.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">{t("bulkSend.colTemplate")}</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">{t("common.status")}</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">{t("common.total")}</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">{t("bulkSend.colAccepted")}</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">{t("bulkSend.colRejected")}</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">{t("bulkSend.colDeliveryFailed")}</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">{t("common.date")}</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">{t("common.csv")}</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((job: BulkSendJob) => {
                  const statusVariant =
                    job.status === "completed" ? "success"
                    : job.status === "failed" ? "danger"
                    : "warning";
                  const statusLabel =
                    job.status === "completed" ? t("bulkSend.statusCompleted")
                    : job.status === "failed" ? t("bulkSend.statusFailed")
                    : job.status === "processing" ? t("bulkSend.statusProcessing")
                    : t("bulkSend.statusQueued");
                  const hasFailures = job.failed > 0 || (job.deliveryFailed ?? 0) > 0;
                  const isExpanded = expandedJobId === job.jobId;
                  return (
                    <Fragment key={job.jobId}>
                      <tr
                        className={`transition-colors ${hasFailures ? "cursor-pointer hover:bg-gray-50" : ""}`}
                        onClick={() => {
                          if (!hasFailures) return;
                          setExpandedJobId(isExpanded ? null : job.jobId);
                        }}
                      >
                        <td className="px-5 py-3 text-sm font-medium text-gray-900">
                          {job.templateName}
                          <span className="ml-1.5 text-xs text-gray-400 font-normal">({job.language})</span>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={statusVariant}>{statusLabel}</Badge>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600 text-right">{job.total}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-sm font-medium text-green-700">{job.sent}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-sm font-medium ${job.failed > 0 ? "text-red-600" : "text-gray-400"}`}>
                            {job.failed}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-sm font-medium ${(job.deliveryFailed ?? 0) > 0 ? "text-orange-600" : "text-gray-400"}`}>
                            {job.deliveryFailed ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-500">{formatDate(job.createdAt)}</td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            title={t("bulkSend.downloadDetail")}
                            disabled={downloadingJobId === job.jobId}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDownloadJobCsv(job);
                            }}
                            className="inline-flex items-center justify-center p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Download className={`w-4 h-4 ${downloadingJobId === job.jobId ? "animate-pulse" : ""}`} />
                          </button>
                        </td>
                        <td className="px-2 py-3 text-gray-400">
                          {hasFailures && (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                        </td>
                      </tr>
                      {isExpanded && hasFailures && (
                        <tr key={`${job.jobId}-failures`}>
                          <td colSpan={9} className="p-0">
                            <BulkJobFailures jobId={job.jobId} templateName={job.templateName} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
