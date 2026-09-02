"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  useProviderCredentials,
  useSaveProviderCredential,
} from "@/hooks/useProviderCredentials";
import { useT } from "@/i18n/context";
import { useQueryClient } from "@tanstack/react-query";

interface ElevenLabsConnectPanelProps {
  className?: string;
}

export function ElevenLabsConnectPanel({ className }: ElevenLabsConnectPanelProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: credentials, isLoading } = useProviderCredentials();
  const save = useSaveProviderCredential("elevenlabs");
  const elevenStatus = credentials?.items.find((item) => item.provider === "elevenlabs");
  const isConnected = Boolean(elevenStatus?.configured);
  const isOwn = elevenStatus?.source === "own";

  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  if (isLoading) {
    return <div className={`h-20 animate-pulse rounded-xl bg-surface-muted ${className ?? ""}`} />;
  }

  if (isConnected && isOwn) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300 ${className ?? ""}`}
      >
        <Link2 className="h-4 w-4 shrink-0" />
        <span>{t("voiceAgents.elevenLabsConnected")}</span>
      </div>
    );
  }

  async function handleConnect(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!apiKey.trim()) {
      setError(t("settings.providerApiKey"));
      return;
    }
    try {
      await save.mutateAsync({ apiKey: apiKey.trim() });
      setApiKey("");
      setEditing(false);
      setSuccess(true);
      void queryClient.invalidateQueries({ queryKey: ["telephony-voices"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.providerSaveError"));
    }
  }

  return (
    <div
      className={`space-y-3 rounded-xl border border-default bg-surface p-4 ${className ?? ""}`}
    >
      <div>
        <p className="text-sm font-medium text-primary">{t("voiceAgents.noElevenLabs")}</p>
        <p className="mt-1 text-sm text-secondary">
          {isConnected ? t("voiceAgents.inheritedElevenLabs") : t("voiceAgents.connectElevenLabsDesc")}
        </p>
      </div>

      {success ? (
        <p className="text-sm text-emerald-700">{t("settings.providerSaved")}</p>
      ) : null}

      {!editing ? (
        <Button type="button" size="sm" onClick={() => setEditing(true)}>
          <Link2 className="h-4 w-4" />
          {t("voiceAgents.connectElevenLabs")}
        </Button>
      ) : (
        <form onSubmit={(event) => void handleConnect(event)} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-secondary">{t("settings.providerApiKey")}</span>
            <div className="relative">
              <input
                type={visible ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="xi-..."
                className="w-full rounded-lg border border-default px-3 py-2 pr-9 text-sm font-mono"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setVisible((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? t("settings.openaiKeySaving") : t("voiceAgents.connectElevenLabs")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setApiKey("");
                setError("");
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
