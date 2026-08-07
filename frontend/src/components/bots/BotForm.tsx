"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCreateBot, useUpdateBot } from "@/hooks/useBots";
import { useLocale, useT } from "@/i18n/context";
import type { Bot, BotLocale } from "@/types";

interface BotFormProps {
  bot?: Bot;
  wide?: boolean;
}

export function BotForm({ bot, wide = false }: BotFormProps) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const isEditing = !!bot;

  const [form, setForm] = useState({
    name: bot?.name ?? "",
    defaultLocale: (bot?.defaultLocale ?? locale) as BotLocale,
    useWebhook: bot?.responseMode === "webhook",
    webhookUrl: bot?.webhookUrl ?? "",
    webhookSecret: "",
  });

  const [error, setError] = useState("");
  const createBot = useCreateBot();
  const updateBot = useUpdateBot(bot?.botId ?? "");

  const isPending = createBot.isPending || updateBot.isPending;
  const isWebhookMode = form.useWebhook;
  const canSubmit = isEditing
    ? form.name.trim().length > 0 && (!isWebhookMode || form.webhookUrl.trim().length > 0)
    : form.name.trim().length > 0;

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
      setError(isEditing && isWebhookMode ? t("bots.webhookUrlRequired") : t("bots.nameRequired"));
      return;
    }

    if (isEditing && isWebhookMode && !form.webhookUrl.trim()) {
      setError(t("bots.webhookUrlRequired"));
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        defaultLocale: form.defaultLocale,
        responseMode: isEditing && isWebhookMode ? "webhook" : "none",
      };

      if (isEditing && isWebhookMode) {
        payload.webhookUrl = form.webhookUrl;
        if (form.webhookSecret) payload.webhookSecret = form.webhookSecret;
      }

      if (isEditing) {
        await updateBot.mutateAsync(payload as Parameters<typeof updateBot.mutateAsync>[0]);
        router.push("/bots");
      } else {
        await createBot.mutateAsync(
          payload as Parameters<typeof createBot.mutateAsync>[0]
        );
        router.push("/bots");
      }
    } catch (err) {
      setError((err as Error).message ?? t("bots.saveError"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6 w-full", !wide && "max-w-2xl")}>
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

        {isEditing && (
          <>
            <div className="col-span-2">
              <label className="mb-2 block text-sm font-medium text-secondary">
                {t("bots.externalIntegration")}
              </label>
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={form.useWebhook}
                  onChange={(e) => setForm((prev) => ({ ...prev, useWebhook: e.target.checked }))}
                  className="rounded border-default"
                />
                {t("bots.useWebhookIntegration")}
              </label>
            </div>

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
                      bot?.webhookSecret
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
          disabled={isPending || !canSubmit}
          className={cn(
            "px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors",
            isPending || !canSubmit
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
