"use client";

import { useEffect, useState } from "react";
import { Maximize2, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getAllowedModelDefinitionsForPlan } from "@/lib/plan-config";
import { AI_MODELS, DEFAULT_MODEL_ID } from "@/lib/ai-models";
import { AiAssistantDisableBlockers } from "@/components/ai-assistant/AiAssistantDisableBlockers";
import { AiModelPicker } from "@/components/ai-assistant/AiModelPicker";
import { useBot } from "@/hooks/useBots";
import { canDisableAiAssistant } from "@/lib/ai-assistant-policy";
import {
  useAiAssistant,
  useDisableAiAssistant,
  useEnableAiAssistant,
  useSaveAiAssistant,
} from "@/hooks/useAiAssistant";
import { BotKnowledge } from "@/components/bots/BotKnowledge";
import { BOT_SYSTEM_PROMPT_MAX_LENGTH } from "@/lib/bot-limits";
import type { Bot, Tenant } from "@/types";

interface AiAssistantSettingsProps {
  bot: Bot;
}

export function AiAssistantSettings({ bot }: AiAssistantSettingsProps) {
  const t = useT();
  const { data: config, isLoading } = useAiAssistant(bot.botId);
  const { data: liveBot } = useBot(bot.botId);
  const save = useSaveAiAssistant(bot.botId);
  const enable = useEnableAiAssistant(bot.botId);
  const disable = useDisableAiAssistant(bot.botId);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

  const [form, setForm] = useState({
    systemPrompt: bot.systemPrompt ?? "",
    model: bot.model ?? DEFAULT_MODEL_ID,
    temperature: bot.temperature ?? 0.7,
    maxTokens: bot.maxTokens ?? 1024,
    knowledgeEnabled: bot.knowledgeEnabled ?? false,
  });

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
  });

  const allowedModels = getAllowedModelDefinitionsForPlan(tenant?.plan ?? "free");
  const displayModels = [...allowedModels];
  if (form.model && !displayModels.some((model) => model.id === form.model)) {
    const currentModel = AI_MODELS.find((model) => model.id === form.model);
    if (currentModel) displayModels.push(currentModel);
  }
  useEffect(() => {
    if (!config) return;
    setForm({
      systemPrompt: config.systemPrompt ?? "",
      model: config.model ?? DEFAULT_MODEL_ID,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 1024,
      knowledgeEnabled: config.knowledgeEnabled ?? false,
    });
  }, [config]);

  useEffect(() => {
    if (!showPromptModal) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setShowPromptModal(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPromptModal]);

  const agent = liveBot ?? bot;
  const enabled = config?.enabled ?? bot.responseMode === "openai";
  const promptEditable = enabled || enable.isPending;
  const systemPromptTooLong = form.systemPrompt.length > BOT_SYSTEM_PROMPT_MAX_LENGTH;
  const isPending = save.isPending || enable.isPending || disable.isPending;
  const disableBlocked = enabled && !canDisableAiAssistant(agent);

  async function handleEnable() {
    setError("");
    if (!form.systemPrompt.trim()) {
      setError(t("aiAssistant.promptRequired"));
      return;
    }
    if (systemPromptTooLong) {
      setError(t("bots.validationSystemPromptTooLong", { max: BOT_SYSTEM_PROMPT_MAX_LENGTH }));
      return;
    }
    try {
      await enable.mutateAsync({
        systemPrompt: form.systemPrompt.trim(),
        model: form.model,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        knowledgeEnabled: form.knowledgeEnabled,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDisable() {
    setError("");
    if (!canDisableAiAssistant(agent)) return;
    try {
      await disable.mutateAsync();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSave() {
    setError("");
    setSaved(false);
    if (systemPromptTooLong) {
      setError(t("bots.validationSystemPromptTooLong", { max: BOT_SYSTEM_PROMPT_MAX_LENGTH }));
      return;
    }
    try {
      await save.mutateAsync({
        systemPrompt: form.systemPrompt.trim(),
        model: form.model,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        knowledgeEnabled: form.knowledgeEnabled,
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (isLoading) {
    return <div className="animate-pulse h-40 rounded-xl bg-surface-muted" />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-default bg-surface-elevated p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-primary">{t("aiAssistant.title")}</h2>
            <p className="mt-1 text-sm text-secondary">{t("aiAssistant.subtitle")}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              enabled ? "bg-green-100 text-green-800" : "bg-surface-muted text-secondary"
            }`}
          >
            {enabled ? t("aiAssistant.statusActive") : t("aiAssistant.statusInactive")}
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          {!enabled ? (
            <button
              type="button"
              onClick={() => void handleEnable()}
              disabled={isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {enable.isPending ? t("common.loading") : t("aiAssistant.enable")}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isPending || systemPromptTooLong}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {save.isPending ? t("common.loading") : t("common.save")}
              </button>
              <button
                type="button"
                onClick={() => void handleDisable()}
                disabled={isPending || disableBlocked}
                className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60"
              >
                {disable.isPending ? t("common.loading") : t("aiAssistant.disable")}
              </button>
            </>
          )}
        </div>

        {enabled && disableBlocked ? <AiAssistantDisableBlockers bot={agent} /> : null}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-700">{t("aiAssistant.saved")}</p>}
      </div>

      <div className="rounded-xl border border-default bg-surface-elevated p-6 space-y-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-secondary">{t("bots.systemPrompt")}</label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPromptModal(true)}
            >
              <Maximize2 className="h-4 w-4" />
              {t("bots.systemPromptExpand")}
            </Button>
          </div>
          <textarea
            rows={5}
            value={form.systemPrompt}
            onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
            disabled={!promptEditable}
            className="w-full resize-none rounded-lg border border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
            placeholder={t("bots.systemPromptPlaceholder")}
          />
          <p className="mt-1 text-xs text-muted">
            {t("bots.systemPromptCharCount", {
              current: form.systemPrompt.length,
              max: BOT_SYSTEM_PROMPT_MAX_LENGTH,
            })}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <AiModelPicker
              value={form.model}
              onChange={(modelId) => setForm((prev) => ({ ...prev, model: modelId }))}
              models={displayModels}
              disabled={!enabled}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t("bots.maxTokens")}
            </label>
            <input
              type="number"
              min={1}
              max={4096}
              value={form.maxTokens}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, maxTokens: Number(e.target.value) }))
              }
              disabled={!enabled}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t("bots.temperature")} ({form.temperature})
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={form.temperature}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, temperature: Number(e.target.value) }))
              }
              disabled={!enabled}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-accent"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={form.knowledgeEnabled}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, knowledgeEnabled: e.target.checked }))
            }
            disabled={!enabled}
            className="rounded border-default"
          />
          {t("knowledge.enabled")}
        </label>
      </div>

      {enabled && <BotKnowledge bot={bot} knowledgeEnabled={form.knowledgeEnabled} showToggle={false} />}

      {showPromptModal ? (
        <Modal className="p-4">
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-default bg-surface-elevated shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-prompt-modal-title"
          >
            <div className="flex items-center justify-between border-b border-default px-6 py-4">
              <h2 id="system-prompt-modal-title" className="text-lg font-semibold text-primary">
                {t("bots.systemPrompt")}
              </h2>
              <button
                type="button"
                onClick={() => setShowPromptModal(false)}
                className="rounded-md p-1 text-muted hover:bg-surface-muted hover:text-secondary"
                aria-label={t("common.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <textarea
                autoFocus
                value={form.systemPrompt}
                onChange={(e) => setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                disabled={!promptEditable}
                maxLength={BOT_SYSTEM_PROMPT_MAX_LENGTH}
                rows={16}
                className="min-h-[50vh] w-full resize-y rounded-lg border border-default px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                placeholder={t("bots.systemPromptPlaceholder")}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default px-6 py-4">
              <p className="text-xs text-muted">
                {t("bots.systemPromptCharCount", {
                  current: form.systemPrompt.length,
                  max: BOT_SYSTEM_PROMPT_MAX_LENGTH,
                })}
              </p>
              <Button type="button" variant="ghost" onClick={() => setShowPromptModal(false)}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
