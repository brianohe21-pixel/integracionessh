"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LayoutTemplate, Settings2, X } from "lucide-react";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useBots } from "@/hooks/useBots";
import {
  useTaskReminderWhatsAppSettings,
  useUpdateTaskReminderWhatsAppSettings,
} from "@/hooks/useSales";
import { useTemplates } from "@/hooks/useTemplates";
import { useT } from "@/i18n/context";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function TaskWhatsAppReminderSettings({ open, onClose }: Props) {
  const t = useT();
  const router = useRouter();
  const { data, isLoading, error: loadError } = useTaskReminderWhatsAppSettings(open);
  const { data: bots = [], isLoading: botsLoading } = useBots();
  const save = useUpdateTaskReminderWhatsAppSettings();
  const [botId, setBotId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("es");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useTemplates(
    open && botId ? botId : undefined,
    "whatsapp"
  );

  const whatsappBots = useMemo(
    () => bots.filter((bot) => Boolean(bot.phoneNumberId)),
    [bots]
  );

  const approvedTemplates = useMemo(
    () => templates.filter((template) => template.status === "APPROVED"),
    [templates]
  );

  const hasNoTemplates =
    Boolean(botId) && !templatesLoading && approvedTemplates.length === 0;

  useEffect(() => {
    if (!open || !data) return;
    setBotId(data.botId ?? "");
    setTemplateName(data.templateName ?? "");
    setTemplateLanguage(data.templateLanguage?.trim() || "es");
    setError("");
    setSaved(false);
  }, [open, data]);

  useEffect(() => {
    if (!open || botsLoading || botId || whatsappBots.length === 0) return;
    setBotId(whatsappBots[0].botId);
  }, [open, botsLoading, botId, whatsappBots]);

  if (!open) return null;

  function goToTemplates() {
    onClose();
    router.push("/templates");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    if (hasNoTemplates) {
      goToTemplates();
      return;
    }

    const name = templateName.trim();
    if (!name) {
      setError(t("tasks.whatsappTemplateRequired"));
      return;
    }
    if (!botId.trim()) {
      setError(t("tasks.whatsappTemplateBotRequired"));
      return;
    }

    try {
      await save.mutateAsync({
        botId: botId.trim(),
        templateName: name,
        templateLanguage: templateLanguage.trim() || "es",
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tasks.whatsappTemplateSaveError"));
    }
  }

  async function handleClear() {
    setError("");
    setSaved(false);
    try {
      await save.mutateAsync({
        botId: "",
        templateName: "",
        templateLanguage: "es",
      });
      setTemplateName("");
      setTemplateLanguage("es");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tasks.whatsappTemplateSaveError"));
    }
  }

  return (
    <Modal>
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-default bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-accent-muted text-accent">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">
                {t("tasks.whatsappTemplateTitle")}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {t("tasks.whatsappTemplateDescription")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-secondary hover:bg-surface-muted hover:text-primary"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading || botsLoading ? (
          <p className="text-sm text-secondary">{t("common.loading")}</p>
        ) : loadError ? (
          <p className="text-sm text-red-500">
            {loadError instanceof Error
              ? loadError.message
              : t("tasks.whatsappTemplateLoadError")}
          </p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-secondary">
                {t("tasks.whatsappTemplateBot")}
              </span>
              <Select
                value={botId}
                onChange={(e) => {
                  setBotId(e.target.value);
                  setTemplateName("");
                  setTemplateLanguage("es");
                  setSaved(false);
                }}
              >
                <option value="">{t("tasks.whatsappTemplateSelectBot")}</option>
                {whatsappBots.map((bot) => (
                  <option key={bot.botId} value={bot.botId}>
                    {bot.name}
                  </option>
                ))}
              </Select>
            </label>

            {hasNoTemplates ? (
              <div className="rounded-xl border border-dashed border-default bg-surface-muted/40 px-4 py-5 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted text-accent">
                  <LayoutTemplate className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-primary">
                  {t("tasks.whatsappTemplateEmptyTitle")}
                </p>
                <p className="mt-1 text-xs text-secondary">
                  {t("tasks.whatsappTemplateEmptyDescription")}
                </p>
                <Button type="button" className="mt-4" onClick={goToTemplates}>
                  <ExternalLink className="h-4 w-4" />
                  {t("tasks.whatsappTemplateCreateCta")}
                </Button>
              </div>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-secondary">
                  {t("tasks.whatsappTemplateName")}
                </span>
                <TemplatePicker
                  botId={botId}
                  channel="whatsapp"
                  value={
                    templateName
                      ? { name: templateName, language: templateLanguage || "es" }
                      : null
                  }
                  onChange={(value) => {
                    setTemplateName(value.name);
                    setTemplateLanguage(value.language);
                    setSaved(false);
                  }}
                  disabled={!botId || templatesLoading}
                />
              </label>
            )}

            {!hasNoTemplates ? (
              <div className="rounded-xl border border-default bg-surface-muted/40 px-3 py-2.5">
                <p className="text-xs text-secondary">{t("tasks.whatsappTemplateHint")}</p>
                <Link
                  href="/templates"
                  onClick={onClose}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("tasks.whatsappTemplateManageLink")}
                </Link>
              </div>
            ) : null}

            {error ? <p className="text-xs text-red-500">{error}</p> : null}
            {saved ? (
              <p className="text-xs text-emerald-600">{t("tasks.whatsappTemplateSaved")}</p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {!hasNoTemplates ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={save.isPending || (!templateName && !data?.templateName)}
                >
                  {t("tasks.whatsappTemplateClear")}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  {t("common.cancel")}
                </Button>
                {hasNoTemplates ? (
                  <Button type="button" onClick={goToTemplates}>
                    {t("tasks.whatsappTemplateCreateCta")}
                  </Button>
                ) : (
                  <Button type="submit" disabled={save.isPending || !botId || templatesLoading}>
                    {save.isPending ? t("common.saving") : t("common.save")}
                  </Button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
