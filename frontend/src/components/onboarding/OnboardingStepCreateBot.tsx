"use client";

import { useEffect, useState } from "react";
import { useCreateBot } from "@/hooks/useBots";
import { useLocale, useT } from "@/i18n/context";
import { DEFAULT_MODEL_ID } from "@/lib/ai-models";
import { getBotTemplate, type BotIndustryTemplateId } from "@/lib/bot-templates";
import { BotTemplatePicker } from "@/components/bots/BotTemplatePicker";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface OnboardingStepCreateBotProps {
  phoneNumberId: string;
  whatsappBusinessAccountId: string;
  templateId: BotIndustryTemplateId | null;
  onTemplateChange: (templateId: BotIndustryTemplateId | null) => void;
  onCreated: (botId: string, templateId: BotIndustryTemplateId | null) => void;
}

export function OnboardingStepCreateBot({
  phoneNumberId,
  whatsappBusinessAccountId,
  templateId,
  onTemplateChange,
  onCreated,
}: OnboardingStepCreateBotProps) {
  const t = useT();
  const locale = useLocale();
  const createBot = useCreateBot();
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (nameTouched || !templateId) return;
    setName(getBotTemplate(templateId).getDefaultBotName(locale));
  }, [templateId, locale, nameTouched]);

  function handleTemplateChange(nextTemplateId: BotIndustryTemplateId | null) {
    onTemplateChange(nextTemplateId);
    if (!nameTouched) {
      setName(
        nextTemplateId ? getBotTemplate(nextTemplateId).getDefaultBotName(locale) : ""
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const systemPrompt = templateId
      ? getBotTemplate(templateId).getSystemPrompt(locale)
      : "You are a helpful customer support assistant.";

    try {
      const bot = await createBot.mutateAsync({
        name: name.trim(),
        responseMode: "openai",
        systemPrompt,
        model: DEFAULT_MODEL_ID,
        temperature: 0.7,
        maxTokens: 1024,
        phoneNumberId,
        whatsappBusinessAccountId,
      });
      onCreated(bot.botId, templateId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("onboarding.createBot.title")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("onboarding.createBot.description")}</p>
      </div>

      <BotTemplatePicker value={templateId} onChange={handleTemplateChange} />

      <div>
        <label className="mb-1 block text-sm font-medium text-secondary">
          {t("onboarding.createBot.nameLabel")}
        </label>
        <Input
          value={name}
          onChange={(e) => {
            setNameTouched(true);
            setName(e.target.value);
          }}
          placeholder={t("onboarding.createBot.namePlaceholder")}
          required
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={createBot.isPending || !name.trim()} className="w-full">
        {createBot.isPending ? t("onboarding.createBot.creating") : t("onboarding.createBot.create")}
      </Button>
    </form>
  );
}
