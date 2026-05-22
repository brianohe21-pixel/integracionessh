"use client";

import { useRef, useState } from "react";
import { useBots } from "@/hooks/useBots";
import { useTemplates } from "@/hooks/useTemplates";
import { useBulkSend, type BulkRecipient } from "@/hooks/useBulkSend";
import { parseRecipientsCsv } from "@/lib/csv";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WhatsAppTemplate } from "@/types";
import {
  SendHorizonal,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Download,
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

export default function BulkSendPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [botId, setBotId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [csvRows, setCsvRows] = useState<ReturnType<typeof parseRecipientsCsv>>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0, failed: 0 });
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const { data: bots } = useBots();
  const { data: templates, isLoading: loadingTemplates } = useTemplates(botId || undefined);
  const bulkMutation = useBulkSend();

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

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseRecipientsCsv(text);
      if (rows.length === 0) {
        setParseError(
          "No se encontraron filas validas. El CSV debe tener encabezado con columna phone, telefono o numero."
        );
        setCsvRows([]);
        return;
      }
      setCsvRows(rows);
    };
    reader.readAsText(file);
  }

  function downloadSample() {
    const headers = ["phone", ...bodyVars.map((_, i) => `var${i + 1}`)];
    const sample = [
      headers.join(","),
      ["573001234567", ...bodyVars.map(() => "valor")].join(","),
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_envio_masivo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkSend() {
    if (!selectedTemplate || !botId || csvRows.length === 0) return;

    setResult(null);
    setProgress({ current: 0, total: csvRows.length, failed: 0 });

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
        }),
    });

    setResult({ sent: res.sent, failed: res.failed });
  }

  const isSending = bulkMutation.isPending;
  const canSend = !!botId && !!templateName && csvRows.length > 0 && !isSending;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Envío masivo</h1>
        <p className="text-sm text-gray-500 mt-1">
          Envía un template de WhatsApp a multiples destinatarios desde un archivo CSV
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Configuracion</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bot</label>
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
              <option value="">Selecciona un bot</option>
              {bots?.map((bot) => (
                <option key={bot.botId} value={bot.botId}>
                  {bot.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
            <select
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              disabled={!botId || loadingTemplates}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">Selecciona un template aprobado</option>
              {approvedTemplates.map((t) => (
                <option key={`${t.name}-${t.language}`} value={t.name}>
                  {t.name} ({t.language})
                </option>
              ))}
            </select>
          </div>

          {selectedTemplate && bodyVars.length > 0 && (
            <p className="text-xs text-gray-500">
              Variables requeridas: {bodyVars.join(", ")}. Agrega columnas adicionales en el CSV en el mismo orden.
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Archivo CSV</h2>
            {selectedTemplate && (
              <button
                type="button"
                onClick={downloadSample}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar plantilla
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
              {fileName || "Seleccionar archivo CSV"}
            </span>
            <span className="text-xs text-gray-400 mt-1">
              Columna obligatoria: phone, telefono o numero
            </span>
          </button>

          {parseError && (
            <p className="text-sm text-red-600">{parseError}</p>
          )}
        </div>
      </div>

      {!botId && (
        <EmptyState
          icon={<SendHorizonal className="w-6 h-6" />}
          title="Selecciona un bot"
          description="Elige un bot y un template aprobado para comenzar el envio masivo."
        />
      )}

      {botId && csvRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">
                {csvRows.length} destinatario{csvRows.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={handleBulkSend}
              disabled={!canSend}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SendHorizonal className="w-4 h-4" />
              {isSending ? "Enviando..." : "Iniciar envio"}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-2">
                    Telefono
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
                Mostrando 50 de {csvRows.length} filas
              </p>
            )}
          </div>
        </div>
      )}

      {isSending && progress.total > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">Progreso</span>
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
          {progress.failed > 0 && (
            <p className="text-xs text-red-600 mt-2">{progress.failed} fallidos hasta ahora</p>
          )}
        </div>
      )}

      {result && (
        <div className="flex items-start gap-4 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{result.sent} enviados</span>
            </div>
            {result.failed > 0 && (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{result.failed} fallidos</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
