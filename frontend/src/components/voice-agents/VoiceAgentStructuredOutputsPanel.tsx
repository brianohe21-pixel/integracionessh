"use client";

import { useEffect, useState } from "react";
import { Braces, Brain } from "lucide-react";
import {
  useSaveTelephonySettings,
  useTelephonySettings,
} from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";
import {
  getStructuredOutputMethod,
  parseStructuredOutputJson,
  serializeStructuredOutputForEditor,
  STRUCTURED_OUTPUT_AI_EXAMPLE,
  STRUCTURED_OUTPUT_REGEX_EXAMPLE,
  validateStructuredOutputJson,
  type StructuredOutputExtractionMethod,
} from "@/lib/telephony-structured-outputs";

interface VoiceAgentStructuredOutputsPanelProps {
  botId: string;
}

export function VoiceAgentStructuredOutputsPanel({ botId }: VoiceAgentStructuredOutputsPanelProps) {
  const t = useT();
  const { data, isLoading } = useTelephonySettings(botId);
  const save = useSaveTelephonySettings(botId);

  const [method, setMethod] = useState<StructuredOutputExtractionMethod>("ai");
  const [jsonConfig, setJsonConfig] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!data) return;
    const definition = data.telephonyStructuredOutput;
    setMethod(getStructuredOutputMethod(definition));
    setJsonConfig(serializeStructuredOutputForEditor(definition));
  }, [data]);

  function handleMethodChange(next: StructuredOutputExtractionMethod) {
    setMethod(next);
    setError("");
    setSuccess("");
    if (!jsonConfig.trim()) {
      setJsonConfig(next === "regex" ? STRUCTURED_OUTPUT_REGEX_EXAMPLE : STRUCTURED_OUTPUT_AI_EXAMPLE);
    }
  }

  function handleLoadExample() {
    setJsonConfig(method === "regex" ? STRUCTURED_OUTPUT_REGEX_EXAMPLE : STRUCTURED_OUTPUT_AI_EXAMPLE);
    setError("");
    setSuccess("");
  }

  function handleSave() {
    const validationError = validateStructuredOutputJson(jsonConfig, t);
    if (validationError) {
      setSuccess("");
      setError(validationError);
      return;
    }

    let definition = null;
    try {
      definition = parseStructuredOutputJson(jsonConfig);
    } catch {
      setSuccess("");
      setError(t("voiceAgents.structuredOutputsJsonInvalid"));
      return;
    }

    setError("");
    save.mutate(
      { telephonyStructuredOutput: definition },
      {
        onSuccess: () => {
          setSuccess(t("telephony.saved"));
          setTimeout(() => setSuccess(""), 3000);
        },
        onError: (err) => setError(err.message),
      }
    );
  }

  return (
    <div className="content-card space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Braces className="h-5 w-5 text-accent" />
        <div>
          <h2 className="text-lg font-semibold text-primary">
            {t("voiceAgents.structuredOutputsTitle")}
          </h2>
          <p className="text-sm text-secondary">{t("voiceAgents.structuredOutputsHint")}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
          {t("voiceAgents.structuredOutputsMethodTitle")}
        </p>
        <p className="text-sm text-secondary">{t("voiceAgents.structuredOutputsMethodHint")}</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => handleMethodChange("ai")}
            className={`rounded-xl border p-4 text-left transition-colors ${
              method === "ai"
                ? "border-accent bg-accent text-white"
                : "border-default bg-surface hover:bg-surface-muted"
            }`}
          >
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{t("voiceAgents.structuredOutputsMethodAi")}</p>
                <p
                  className={`mt-1 text-sm ${
                    method === "ai" ? "text-white/90" : "text-secondary"
                  }`}
                >
                  {t("voiceAgents.structuredOutputsMethodAiHint")}
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleMethodChange("regex")}
            className={`rounded-xl border p-4 text-left transition-colors ${
              method === "regex"
                ? "border-accent bg-accent text-white"
                : "border-default bg-surface hover:bg-surface-muted"
            }`}
          >
            <div className="flex items-start gap-3">
              <Braces className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{t("voiceAgents.structuredOutputsMethodRegex")}</p>
                <p
                  className={`mt-1 text-sm ${
                    method === "regex" ? "text-white/90" : "text-secondary"
                  }`}
                >
                  {t("voiceAgents.structuredOutputsMethodRegexHint")}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <p className="text-xs text-secondary">{t("voiceAgents.structuredOutputsWebhookNote")}</p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {isLoading ? (
        <div className="h-24 animate-pulse rounded bg-surface-muted" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-primary">{t("voiceAgents.structuredOutputsJsonLabel")}</p>
            <button
              type="button"
              onClick={handleLoadExample}
              className="text-sm font-medium text-accent hover:underline"
            >
              {t("voiceAgents.structuredOutputsLoadExample")}
            </button>
          </div>

          <textarea
            value={jsonConfig}
            onChange={(e) => setJsonConfig(e.target.value)}
            rows={14}
            spellCheck={false}
            placeholder={
              method === "regex" ? STRUCTURED_OUTPUT_REGEX_EXAMPLE : STRUCTURED_OUTPUT_AI_EXAMPLE
            }
            className="w-full rounded-lg border border-default px-3 py-2 text-xs font-mono"
          />

          <p className="text-xs text-secondary">
            {method === "regex"
              ? t("voiceAgents.structuredOutputsRegexFormatHint")
              : t("voiceAgents.structuredOutputsFormatHint")}
          </p>

          <button
            type="button"
            onClick={handleSave}
            disabled={save.isPending}
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {save.isPending ? t("bots.saving") : t("common.save")}
          </button>
        </>
      )}
    </div>
  );
}
