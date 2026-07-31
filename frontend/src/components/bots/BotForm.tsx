"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useCreateBot, useUpdateBot } from "@/hooks/useBots";
import { useCreateFlow, useToggleFlow } from "@/hooks/useFlows";
import { useWhatsAppConnect } from "@/hooks/useWhatsAppConnect";
import { useLocale, useT } from "@/i18n/context";
import { getAllowedModelDefinitionsForPlan } from "@/lib/plan-config";
import {
  AI_MODEL_CATEGORIES,
  AI_MODELS,
  DEFAULT_MODEL_ID,
  groupModelsByCategory,
  type AiModelCategory,
} from "@/lib/ai-models";
import { getBotTemplate } from "@/lib/bot-templates";
import type { BotIndustryTemplateId } from "@/lib/bot-templates";
import { EmbeddedSignupLauncher } from "@/components/whatsapp/EmbeddedSignupLauncher";
import { BotTemplatePicker } from "@/components/bots/BotTemplatePicker";
import type { Bot, BotLocale, Tenant } from "@/types";

const SYSTEM_PROMPT_MAX_LENGTH = 4096;

interface BotFormProps {
  bot?: Bot;
  wide?: boolean;
}

export function BotForm({ bot, wide = false }: BotFormProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const isEditing = !!bot;

  const [templateId, setTemplateId] = useState<BotIndustryTemplateId | null>(null);
  const [formTouched, setFormTouched] = useState({ name: false, systemPrompt: false });

  const [form, setForm] = useState({
    name: bot?.name ?? "",
    defaultLocale: (bot?.defaultLocale ?? locale) as BotLocale,
    responseMode: bot?.responseMode ?? "openai",
    systemPrompt: bot?.systemPrompt ?? "",
    model: bot?.model ?? DEFAULT_MODEL_ID,
    temperature: bot?.temperature ?? 0.7,
    maxTokens: bot?.maxTokens ?? 1024,
    webhookUrl: bot?.webhookUrl ?? "",
    webhookSecret: "",
    phoneNumberId: bot?.phoneNumberId ?? "",
    whatsappBusinessAccountId: bot?.whatsappBusinessAccountId ?? "",
  });

  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [whatsappConnected, setWhatsappConnected] = useState(bot?.whatsappPhone != null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const createBot = useCreateBot();
  const updateBot = useUpdateBot(bot?.botId ?? "");
  const createFlow = useCreateFlow();
  const toggleFlow = useToggleFlow();
  const { connectManual, status: whatsappStatus } = useWhatsAppConnect();

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });

  const allowedModels = getAllowedModelDefinitionsForPlan(tenant?.plan ?? "free");
  const displayModels = [...allowedModels];
  if (isEditing && form.model && !displayModels.some((model) => model.id === form.model)) {
    const currentModel = AI_MODELS.find((model) => model.id === form.model);
    if (currentModel) displayModels.push(currentModel);
  }
  const modelsByCategory = groupModelsByCategory(displayModels);

  function getModelCategoryLabel(category: AiModelCategory): string {
    return t(`bots.modelCategory.${category}`);
  }

  const isPending =
    createBot.isPending ||
    updateBot.isPending ||
    createFlow.isPending ||
    toggleFlow.isPending ||
    whatsappStatus === "connecting";
  const isWebhookMode = form.responseMode === "webhook";
  const hasManualIds =
    form.phoneNumberId.trim().length > 0 && form.whatsappBusinessAccountId.trim().length > 0;
  const pinValid = /^\d{6}$/.test(pin);
  const hasManualCredentials = accessToken.trim().length > 0 && pinValid;
  const canSubmit =
    whatsappConnected || (advancedMode && hasManualIds && hasManualCredentials);
  const systemPromptLength = form.systemPrompt.length;
  const systemPromptTooLong = !isWebhookMode && systemPromptLength > SYSTEM_PROMPT_MAX_LENGTH;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    if (name === "name") {
      setFormTouched((prev) => ({ ...prev, name: true }));
    }
    if (name === "systemPrompt") {
      setFormTouched((prev) => ({ ...prev, systemPrompt: true }));
    }
    setForm((prev) => ({
      ...prev,
      [name]: name === "temperature" || name === "maxTokens" ? Number(value) : value,
    }));
  }

  function handleTemplateChange(nextTemplateId: BotIndustryTemplateId | null) {
    setTemplateId(nextTemplateId);
    if (!nextTemplateId) return;

    const template = getBotTemplate(nextTemplateId);
    setForm((prev) => ({
      ...prev,
      name: formTouched.name ? prev.name : template.getDefaultBotName(locale),
      systemPrompt: formTouched.systemPrompt ? prev.systemPrompt : template.getSystemPrompt(locale),
      responseMode: "openai",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError(
        advancedMode && hasManualIds && !hasManualCredentials
          ? t("bots.manualCredentialsRequired")
          : t("bots.whatsappRequired")
      );
      return;
    }

    if (advancedMode && hasManualIds && hasManualCredentials && !whatsappConnected) {
      if (!pinValid) {
        setPinError(t("whatsapp.pinInvalid"));
        return;
      }
    }

    if (!isWebhookMode && systemPromptLength > SYSTEM_PROMPT_MAX_LENGTH) {
      setError(t("bots.validationSystemPromptTooLong", { max: SYSTEM_PROMPT_MAX_LENGTH }));
      return;
    }

    try {
      if (
        advancedMode &&
        hasManualIds &&
        hasManualCredentials &&
        (!whatsappConnected || accessToken.trim().length > 0)
      ) {
        setPinError("");
        await connectManual({
          accessToken: accessToken.trim(),
          wabaId: form.whatsappBusinessAccountId.trim(),
          phoneNumberId: form.phoneNumberId.trim(),
          pin,
        });
        setWhatsappConnected(true);
      }

      const payload: Record<string, unknown> = {
        name: form.name,
        defaultLocale: form.defaultLocale,
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
        router.push("/bots");
      } else {
        const createdBot = await createBot.mutateAsync(
          payload as Parameters<typeof createBot.mutateAsync>[0]
        );

        if (templateId) {
          const flowDefinition = getBotTemplate(templateId).getFlowDefinition(locale);
          const flow = await createFlow.mutateAsync({
            name: flowDefinition.name,
            botId: createdBot.botId,
            enabled: false,
            nodes: flowDefinition.nodes,
            edges: flowDefinition.edges,
            entryNodeId: flowDefinition.entryNodeId,
          });
          await toggleFlow.mutateAsync({ flowId: flow.flowId, enabled: true });
          router.push(`/bots/${createdBot.botId}/edit`);
        } else {
          router.push("/bots");
        }
      }
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6 w-full", !wide && "max-w-2xl")}>
      {!isEditing && (
        <div className="col-span-2">
          <BotTemplatePicker value={templateId} onChange={handleTemplateChange} />
        </div>
      )}

      <div className={cn("grid gap-4", wide ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-2")}>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-secondary mb-1">
            {t("bots.botName")}
          </label>
          <input
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder={t("bots.botNamePlaceholder")}
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-secondary mb-1">
            {t("bots.defaultLocale")}
          </label>
          <select
            name="defaultLocale"
            value={form.defaultLocale}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface-elevated"
          >
            <option value="es">{t("bots.defaultLocaleEs")}</option>
            <option value="en">{t("bots.defaultLocaleEn")}</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-secondary mb-2">
            {t("bots.responseMode")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, responseMode: "openai" }))}
              className={cn(
                "flex flex-col items-start gap-1 px-4 py-3 rounded-lg border-2 text-left transition-colors",
                !isWebhookMode
                  ? "border-accent bg-accent-muted"
                  : "border-default hover:border-default"
              )}
            >
              <span className="text-sm font-medium text-primary">{t("bots.openAiMode")}</span>
              <span className="text-xs text-secondary">{t("bots.openAiModeDesc")}</span>
            </button>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, responseMode: "webhook" }))}
              className={cn(
                "flex flex-col items-start gap-1 px-4 py-3 rounded-lg border-2 text-left transition-colors",
                isWebhookMode
                  ? "border-accent bg-accent-muted"
                  : "border-default hover:border-default"
              )}
            >
              <span className="text-sm font-medium text-primary">{t("bots.webhookMode")}</span>
              <span className="text-xs text-secondary">{t("bots.webhookModeDesc")}</span>
            </button>
          </div>
        </div>

        {!isWebhookMode && (
          <>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-secondary mb-1">
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
                    : "border-default focus:ring-accent"
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
                    systemPromptTooLong ? "text-red-600" : "text-muted"
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
              <label className="block text-sm font-medium text-secondary mb-1">{t("bots.model")}</label>
              <select
                name="model"
                value={form.model}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent bg-surface-elevated"
              >
                {AI_MODEL_CATEGORIES.map((category) => {
                  const models = modelsByCategory[category];
                  if (!models?.length) return null;
                  return (
                    <optgroup key={category} label={getModelCategoryLabel(category)}>
                      {models.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              {tenant?.plan !== "enterprise" && (
                <p className="mt-1 text-xs text-secondary">{t("bots.modelPlanHint")}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
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
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent mt-3"
              />
              <div className="flex justify-between text-xs text-muted mt-1">
                <span>{t("bots.tempPrecise")}</span>
                <span>{t("bots.tempCreative")}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {t("bots.maxTokens")}
              </label>
              <input
                name="maxTokens"
                type="number"
                min="1"
                max="4096"
                value={form.maxTokens}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </>
        )}

        {isWebhookMode && (
          <>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-secondary mb-1">
                {t("bots.webhookUrl")}
              </label>
              <input
                name="webhookUrl"
                type="url"
                required
                value={form.webhookUrl}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                placeholder={t("bots.webhookUrlPlaceholder")}
              />
              <p className="mt-1 text-xs text-secondary">{t("bots.webhookHttpsOnly")}</p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-secondary mb-1">
                {t("bots.webhookSecret")}{" "}
                <span className="font-normal text-muted">{t("bots.webhookSecretOptional")}</span>
              </label>
              <input
                name="webhookSecret"
                type="password"
                value={form.webhookSecret}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                placeholder={
                  isEditing && bot?.webhookSecret
                    ? t("bots.webhookSecretKeep")
                    : t("bots.webhookSecretPlaceholder")
                }
              />
              <p className="mt-1 text-xs text-secondary">{t("bots.webhookSecretHint")}</p>
            </div>

            <div className="col-span-2 rounded-lg border border-default bg-surface p-4 text-xs text-secondary space-y-2">
              <p className="font-medium text-secondary">{t("bots.webhookContractTitle")}</p>
              <p>{t("bots.webhookContractPost")}</p>
              <pre className="bg-surface-elevated border border-default rounded p-2 overflow-x-auto text-xs">{`{
  "message": "texto del usuario",
  "from": "número de teléfono",
  "conversationId": "uuid",
  "botId": "uuid",
  "contact": { "name": "Nombre" }
}`}</pre>
              <p>{t("bots.webhookContractResponse")}</p>
              <pre className="bg-surface-elevated border border-default rounded p-2 overflow-x-auto text-xs">{`{ "reply": "texto de respuesta" }`}</pre>
            </div>
          </>
        )}

        {!advancedMode && (
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
            <p className="mt-2 text-xs text-secondary">{t("bots.sharedTokenNote")}</p>
          </div>
        )}

        <div className="col-span-2">
          <button
            type="button"
            onClick={() => setAdvancedMode((v) => !v)}
            className="text-xs font-medium text-accent hover:text-accent"
          >
            {advancedMode ? t("bots.advancedModeHide") : t("bots.advancedMode")}
          </button>
        </div>

        {advancedMode && (
          <>
            <p className="col-span-2 text-xs text-secondary">{t("bots.manualModeHint")}</p>
            <p className="col-span-2 text-xs text-secondary">{t("bots.sharedTokenNote")}</p>

            <details className="col-span-2 rounded-lg border border-accent/20 bg-accent-muted/60 p-4 text-xs text-secondary">
              <summary className="font-medium text-accent cursor-pointer select-none">
                {t("bots.accessTokenGuideTitle")}
              </summary>
              <ol className="mt-3 space-y-2 list-decimal list-inside text-secondary">
                <li>{t("bots.accessTokenGuideStep1")}</li>
                <li>{t("bots.accessTokenGuideStep2")}</li>
                <li>{t("bots.accessTokenGuideStep3")}</li>
                <li>{t("bots.accessTokenGuideStep4")}</li>
                <li>{t("bots.accessTokenGuideStep5")}</li>
                <li>{t("bots.accessTokenGuideStep6")}</li>
                <li>{t("bots.accessTokenGuideStep7")}</li>
              </ol>
              <a
                href="https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#system-user-access-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-accent underline hover:text-accent"
              >
                {t("bots.accessTokenGuideMetaLink")}
              </a>
            </details>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {t("bots.phoneNumberId")}
              </label>
              <input
                name="phoneNumberId"
                type="text"
                value={form.phoneNumberId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                placeholder={t("bots.phonePlaceholder")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                {t("bots.wabaId")}
              </label>
              <input
                name="whatsappBusinessAccountId"
                type="text"
                value={form.whatsappBusinessAccountId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                placeholder={t("bots.wabaPlaceholder")}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-secondary mb-1">
                {t("bots.accessTokenLabel")}
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono"
                placeholder={t("bots.accessTokenPlaceholder")}
              />
              <p className="mt-1 text-xs text-secondary">{t("bots.accessTokenHint")}</p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-secondary mb-1">
                {t("whatsapp.pinLabel")}
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (pinError) setPinError("");
                }}
                className="w-full max-w-xs px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono tracking-widest"
                placeholder={t("whatsapp.pinPlaceholder")}
              />
              <p className="mt-1 text-xs text-secondary">{t("whatsapp.pinHint")}</p>
              {pinError && <p className="mt-1 text-xs text-red-600">{pinError}</p>}
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
              ? "bg-accent/60 cursor-not-allowed"
              : "bg-accent hover:bg-accent-hover"
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
          className="px-5 py-2 rounded-lg text-sm font-medium text-secondary hover:bg-surface-muted transition-colors"
        >
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
