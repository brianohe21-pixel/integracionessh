"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  buildApiKeyScopes,
  getSelectedOptionalScopes,
  OPTIONAL_OTP_API_KEY_SCOPES,
  OPTIONAL_VOICE_API_KEY_SCOPES,
} from "@/lib/api-key-scopes";
import { useUpdateApiKey } from "@/hooks/useApiKeys";
import type { ApiKey } from "@/types";
import { useT } from "@/i18n/context";

const OPTIONAL_SCOPE_LABEL_KEYS: Record<string, string> = {
  "voice:calls:initiate": "developer.scopeVoiceInitiate",
  "voice:calls:read": "developer.scopeVoiceRead",
  "voice:calls:manage": "developer.scopeVoiceManage",
  "otp:send": "developer.scopeOtpSend",
  "otp:verify": "developer.scopeOtpVerify",
};

interface ApiKeyScopesModalProps {
  apiKey: ApiKey;
  onClose: () => void;
}

export function ApiKeyScopesModal({ apiKey, onClose }: ApiKeyScopesModalProps) {
  const t = useT();
  const updateKey = useUpdateApiKey();
  const [selected, setSelected] = useState<string[]>(getSelectedOptionalScopes(apiKey.scopes));

  function toggleScope(scope: string) {
    setSelected((current) =>
      current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]
    );
  }

  async function handleSave() {
    await updateKey.mutateAsync({
      keyId: apiKey.keyId,
      scopes: buildApiKeyScopes(selected),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-surface-elevated rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-subtle">
          <h2 className="text-base font-semibold text-primary">{t("developer.scopesTitle")}</h2>
          <button onClick={onClose} className="text-muted hover:text-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-secondary">{t("developer.scopesSubtitle")}</p>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                {t("developer.otpScopesLabel")}
              </p>
              <div className="space-y-3">
                {OPTIONAL_OTP_API_KEY_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-start gap-3 rounded-lg border border-default p-3 cursor-pointer hover:bg-surface-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="mt-0.5 h-4 w-4 rounded border-default text-accent focus:ring-accent"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary">
                        {t(OPTIONAL_SCOPE_LABEL_KEYS[scope] ?? scope)}
                      </p>
                      <code className="text-xs text-muted font-mono">{scope}</code>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                {t("developer.voiceScopesLabel")}
              </p>
              <div className="space-y-3">
                {OPTIONAL_VOICE_API_KEY_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-start gap-3 rounded-lg border border-default p-3 cursor-pointer hover:bg-surface-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="mt-0.5 h-4 w-4 rounded border-default text-accent focus:ring-accent"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary">
                        {t(OPTIONAL_SCOPE_LABEL_KEYS[scope] ?? scope)}
                      </p>
                      <code className="text-xs text-muted font-mono">{scope}</code>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {updateKey.isError && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {updateKey.error?.message ?? t("developer.scopesSaveError")}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-secondary bg-surface-muted rounded-lg hover:bg-gray-200"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={updateKey.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50"
            >
              {updateKey.isPending ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
