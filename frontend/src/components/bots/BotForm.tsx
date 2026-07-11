"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useCreateBot, useUpdateBot } from "@/hooks/useBots";
import { useT } from "@/i18n/context";
import { getAllowedModelsForPlan } from "@/lib/plan-config";
import { EmbeddedSignupLauncher } from "@/components/whatsapp/EmbeddedSignupLauncher";
import type { Bot, Tenant } from "@/types";

const SYSTEM_PROMPT_MAX_LENGTH = 4096;

interface BotFormProps {
  bot?: Bot;
  wide?: boolean;
}

export function BotForm({ bot, wide = false }: BotFormProps) {
  const t = useT();
  const router = useRouter();
  const isEditing = !!bot;

  const [form, setForm] = useState({
    name: bot?.name ?? "",
    responseMode: bot?.responseMode ?? "openai",
    systemPrompt: bot?.systemPrompt ?? "",
    model: bot?.model ?? "gpt-4o-mini",
    temperature: bot?.temperature ?? 0.7,
    maxTokens: bot?.maxTokens ?? 1024,
    webhookUrl: bot?.webhookUrl ?? "",
    webhookSecret: "",
    phoneNumberId: bot?.phoneNumberId ?? "",
    whatsappBusinessAccountId: bot?.whatsappBusinessAccountId ?? "",
  });

  const [error, setError] = useState("");
  const [whatsappConnected, setWhatsappConnected] = useState(
    Boolean(bot?.phoneNumberId && bot?.whatsappBusinessAccountId)
  );
  const [advancedMode, setAdvancedMode] = useState(false);
  const createBot = useCreateBot();
  const updateBot = useUpdateBot(bot?.botId ?? "");

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });

  const allowedModels = getAllowedModelsForPlan(tenant?.plan ?? "free");
  const modelLabels: Record<string, string> = {
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4o": "GPT-4o",
    "gpt-4-turbo": "GPT-4 Turbo",
  };

  const isPending = createBot.isPending || updateBot.isPending;
  const isWebhookMode = form.responseMode === "webhook";
  const hasManualIds =
    form.phoneNumberId.trim().length > 0 && form.whatsappBusinessAccountId.trim().length > 0;
  const canSubmit = whatsappConnected || (advancedMode && hasManualIds);
  const systemPromptLength = form.systemPrompt.length;
  const systemPromptTooLong = !isWebhookMode && systemPromptLength > SYSTEM_PROMPT_MAX_LENGTH;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "temperature" || name === "maxTokens" ? Number(value) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError(t("bots.whatsappRequired"));
      return;
    }

    if (!isWebhookMode && systemPromptLength > SYSTEM_PROMPT_MAX_LENGTH) {
      setError(t("bots.validationSystemPromptTooLong", { max: SYSTEM_PROMPT_MAX_LENGTH }));
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        responseMode: form.responseMode,
        phoneNumberId: form.phoneNumberId,
        whatsappBusinessAccountId: form.whatsappBusinessAccountId,
      };

      if (isWebhookMode) {
        payload.webhookUrl = form.webhookUrl;
        if (form.webhookSecret) payload.webhookSecret = form.webhookSecret;
      } else {
        payload.systemPrompt = form.systemPrompt;
        payload.model = form.model;
        payload.temperature = form.temperature;
        payload.maxTokens = form.maxTokens;
      }

      if (isEditing) {
        await updateBot.mutateAsync(payload as Parameters<typeof updateBot.mutateAsync>[0]);
      } else {
        await createBot.mutateAsync(payload as Parameters<typeof createBot.mutateAsync>[0]);
      }
      router.push("/bots");
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6 w-full", !wide && "max-w-2xl")}>
      <div className={cn("grid gap-4", wide ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-2")}>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("bots.botName")}
          </label>
          <input
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={t("bots.botNamePlaceholder")}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("bots.responseMode")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, responseMode: "openai" }))}
              className={cn(
                "flex flex-col items-start gap-1 px-4 py-3 rounded-lg border-2 text-left transition-colors",
                !isWebhookMode
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="text-sm font-medium text-gray-900">{t("bots.openAiMode")}</span>
              <span className="text-xs text-gray-500">{t("bots.openAiModeDesc")}</span>
            </button>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, responseMode: "webhook" }))}
              className={cn(
                "flex flex-col items-start gap-1 px-4 py-3 rounded-lg border-2 text-left transition-colors",
                isWebhookMode
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <span className="text-sm font-medium text-gray-900">{t("bots.webhookMode")}</span>
              <span className="text-xs text-gray-500">{t("bots.webhookModeDesc")}</span>
            </button>
          </div>
        </div>

        {!isWebhookMode && (
          <>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("bots.systemPrompt")}
              </label>
              <textarea
                name="systemPrompt"
                required
                rows={5}
                value={form.systemPrompt}
                onChange={handleChange}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 resize-none",
                  systemPromptTooLong
                    ? "border-red-300 focus:ring-red-500"
                    : "border-gray-300 focus:ring-indigo-500"
                )}
                placeholder={t("bots.systemPromptPlaceholder")}
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                {systemPromptTooLong ? (
                  <p className="text-xs text-red-600">
                    {t("bots.validationSystemPromptTooLong", { max: SYSTEM_PROMPT_MAX_LENGTH })}
                  </p>
                ) : (
                  <span />
                )}
                <p
                  className={cn(
                    "text-xs tabular-nums",
                    systemPromptTooLong ? "text-red-600" : "text-gray-400"
                  )}
                >
                  {t("bots.systemPromptCharCount", {
                    current: systemPromptLength,
                    max: SYSTEM_PROMPT_MAX_LENGTH,
                  })}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("bots.model")}</label>
              <select
                name="model"
                value={form.model}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {allowedModels.map((model) => (
                  <option key={model} value={model}>
                    {modelLabels[model] ?? model}
                  </option>
                ))}
              </select>
              {tenant?.plan !== "enterprise" && (
                <p className="mt-1 text-xs text-gray-500">{t("bots.modelPlanHint")}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("bots.temperature")} ({form.temperature})
              </label>
              <input
                name="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={handleChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-3"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{t("bots.tempPrecise")}</span>
                <span>{t("bots.tempCreative")}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("bots.maxTokens")}
              </label>
              <input
                name="maxTokens"
                type="number"
                min="1"
                max="4096"
                value={form.maxTokens}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </>
        )}

        {isWebhookMode && (
          <>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("bots.webhookUrl")}
              </label>
              <input
                name="webhookUrl"
                type="url"
                required
                value={form.webhookUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder={t("bots.webhookUrlPlaceholder")}
              />
              <p className="mt-1 text-xs text-gray-500">{t("bots.webhookHttpsOnly")}</p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("bots.webhookSecret")}{" "}
                <span className="font-normal text-gray-400">{t("bots.webhookSecretOptional")}</span>
              </label>
              <input
                name="webhookSecret"
                type="password"
                value={form.webhookSecret}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder={
                  isEditing && bot?.webhookSecret
                    ? t("bots.webhookSecretKeep")
                    : t("bots.webhookSecretPlaceholder")
                }
              />
              <p className="mt-1 text-xs text-gray-500">{t("bots.webhookSecretHint")}</p>
            </div>

            <div className="col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 space-y-2">
              <p className="font-medium text-gray-700">{t("bots.webhookContractTitle")}</p>
              <p>{t("bots.webhookContractPost")}</p>
              <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto text-xs">{`{
  "message": "texto del usuario",
  "from": "número de teléfono",
  "conversationId": "uuid",
  "botId": "uuid",
  "contact": { "name": "Nombre" }
}`}</pre>
              <p>{t("bots.webhookContractResponse")}</p>
              <pre className="bg-white border border-gray-200 rounded p-2 overflow-x-auto text-xs">{`{ "reply": "texto de respuesta" }`}</pre>
            </div>
          </>
        )}

        <div className="col-span-2">
          <EmbeddedSignupLauncher
            alreadyConnected={whatsappConnected}
            onConnected={({ phoneNumberId, whatsappBusinessAccountId }) => {
              setForm((prev) => ({
                ...prev,
                phoneNumberId,
                whatsappBusinessAccountId,
              }));
              setWhatsappConnected(true);
            }}
          />
          <p className="mt-2 text-xs text-gray-500">{t("bots.sharedTokenNote")}</p>
        </div>

        <div className="col-span-2">
          <button
            type="button"
            onClick={() => setAdvancedMode((v) => !v)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            {advancedMode ? t("bots.advancedModeHide") : t("bots.advancedMode")}
          </button>
        </div>

        {advancedMode && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("bots.phoneNumberId")}
              </label>
              <input
                name="phoneNumberId"
                type="text"
                value={form.phoneNumberId}
                onChange={(e) => {
                  handleChange(e);
                  if (e.target.value && form.whatsappBusinessAccountId) {
                    setWhatsappConnected(true);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder={t("bots.phonePlaceholder")}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("bots.wabaId")}
              </label>
              <input
                name="whatsappBusinessAccountId"
                type="text"
                value={form.whatsappBusinessAccountId}
                onChange={(e) => {
                  handleChange(e);
                  if (e.target.value && form.phoneNumberId) {
                    setWhatsappConnected(true);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                placeholder={t("bots.wabaPlaceholder")}
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending || !canSubmit || systemPromptTooLong}
          className={cn(
            "px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors",
            isPending || !canSubmit || systemPromptTooLong
              ? "bg-indigo-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          )}
        >
          {isPending
            ? t("bots.saving")
            : isEditing
              ? t("bots.saveChanges")
              : t("bots.createBot")}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
