"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  useAdminPlatformOpenAI,
  useDeleteAdminPlatformOpenAI,
  useSaveAdminPlatformOpenAI,
} from "@/hooks/useAdminPlatformOpenAI";
import { useT } from "@/i18n/context";

export default function AdminOpenAIPage() {
  const t = useT();
  const { data, isLoading, isError } = useAdminPlatformOpenAI();
  const save = useSaveAdminPlatformOpenAI();
  const remove = useDeleteAdminPlatformOpenAI();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const configured = data?.configured ?? false;
  const pending = save.isPending || remove.isPending;

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    try {
      await save.mutateAsync(apiKey.trim());
      setApiKey("");
      setShowKey(false);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.openai.saveError"));
    }
  }

  async function handleDelete() {
    setError("");
    setSaved(false);
    try {
      await remove.mutateAsync();
      setApiKey("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.openai.saveError"));
    }
  }

  return (
    <DashboardPage className="space-y-6 pb-8">
      <PageHeader title={t("admin.openai.title")} subtitle={t("admin.openai.subtitle")} />

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />
      ) : isError ? (
        <p className="text-sm text-red-600">{t("admin.openai.loadError")}</p>
      ) : (
        <section className="max-w-xl space-y-5 rounded-xl border border-default bg-surface-elevated p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-primary">{t("admin.openai.currentKey")}</p>
              <p className="mt-1 font-mono text-sm text-secondary">
                {configured ? data?.maskedKey : t("admin.openai.notConfigured")}
              </p>
            </div>
            <Badge variant={configured ? "success" : "default"}>
              {configured ? t("admin.openai.configured") : t("admin.openai.missing")}
            </Badge>
          </div>

          <p className="text-sm leading-relaxed text-secondary">{t("admin.openai.hint")}</p>

          <form onSubmit={(event) => void handleSave(event)} className="space-y-3">
            <label className="flex flex-col gap-2 text-sm text-secondary">
              <span>{t("admin.openai.newKey")}</span>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-..."
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setSaved(false);
                    setError("");
                  }}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-2 pr-10 font-mono text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
                  aria-label={showKey ? t("admin.openai.hideKey") : t("admin.openai.showKey")}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {saved ? <p className="text-sm text-accent">{t("admin.openai.saved")}</p> : null}

            <div className="flex flex-wrap justify-end gap-2">
              {configured ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handleDelete()}
                  disabled={pending}
                >
                  {t("admin.openai.remove")}
                </Button>
              ) : null}
              <Button type="submit" disabled={pending || apiKey.trim().length < 20}>
                {save.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </div>
          </form>
        </section>
      )}
    </DashboardPage>
  );
}
