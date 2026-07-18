"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/i18n/context";

interface CallingSettingsResponse {
  calling?: {
    status?: "ENABLED" | "DISABLED";
    callback_permission_status?: string;
  };
}

interface BotCallingSettingsProps {
  botId: string;
}

export function BotCallingSettings({ botId }: BotCallingSettingsProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["calling-settings", botId],
    queryFn: () => api.get<CallingSettingsResponse>(`/bots/${botId}/calling/settings`),
  });

  const enabled = data?.calling?.status === "ENABLED";

  const updateMutation = useMutation({
    mutationFn: (nextEnabled: boolean) =>
      api.put<CallingSettingsResponse>(`/bots/${botId}/calling/settings`, {
        calling: { status: nextEnabled ? "ENABLED" : "DISABLED" },
      }),
    onSuccess: () => {
      setError("");
      setSuccess(t("bots.callingSaved"));
      queryClient.invalidateQueries({ queryKey: ["calling-settings", botId] });
      setTimeout(() => setSuccess(""), 3000);
    },
    onError: (err: Error) => {
      setSuccess("");
      setError(err.message || t("bots.callingSaveError"));
    },
  });

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6">
      <div className="flex items-center gap-2 mb-2">
        <Phone className="w-4 h-4 text-secondary" />
        <h2 className="text-sm font-semibold text-primary">{t("bots.callingTitle")}</h2>
      </div>
      <p className="text-sm text-secondary mb-4">{t("bots.callingDescription")}</p>

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-800">{t("bots.callingPrerequisites")}</p>
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/calling/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-900 underline mt-1 inline-block"
        >
          {t("bots.callingMetaDocs")}
        </a>
      </div>

      {isLoading ? (
        <div className="h-10 bg-surface-muted rounded animate-pulse" />
      ) : (
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-secondary">{t("bots.callingEnable")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate(!enabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
              enabled ? "bg-accent" : "bg-gray-200"
            } ${updateMutation.isPending ? "opacity-50" : ""}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface-elevated shadow transition ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      )}

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {success && <p className="text-sm text-green-600 mt-3">{success}</p>}
    </div>
  );
}
