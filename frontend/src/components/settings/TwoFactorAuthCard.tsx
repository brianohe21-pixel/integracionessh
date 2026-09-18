"use client";

import { useEffect, useState } from "react";
import {
  fetchAuthSession,
  fetchMFAPreference,
  setUpTOTP,
  updateMFAPreference,
  verifyTOTPSetup,
} from "aws-amplify/auth";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { QrCodeImage } from "@/components/ui/QrCodeImage";
import {
  SettingsCallout,
  SettingsCard,
  SettingsCardSkeleton,
} from "@/components/settings/SettingsCard";
import { useT } from "@/i18n/context";

function hasFederatedIdentity(payload: Record<string, unknown> | undefined): boolean {
  if (!payload) return false;
  const raw = payload.identities;
  if (!raw) return false;
  try {
    const identities = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(identities) && identities.length > 0;
  } catch {
    return false;
  }
}

export function TwoFactorAuthCard() {
  const t = useT();
  const [federated, setFederated] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [setupUri, setSetupUri] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [setupMode, setSetupMode] = useState(false);

  async function loadStatus() {
    setLoading(true);
    setError("");
    try {
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;
      if (hasFederatedIdentity(payload)) {
        setFederated(true);
        setEnabled(false);
        return;
      }
      const preference = await fetchMFAPreference();
      setEnabled(preference.enabled?.includes("TOTP") ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.twoFactorLoadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleStartSetup() {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const session = await fetchAuthSession();
      const email = String(session.tokens?.idToken?.payload?.email ?? "");
      const setup = await setUpTOTP();
      const uri = setup.getSetupUri("IntegracionesSSH", email).toString();
      setSetupSecret(setup.sharedSecret);
      setSetupUri(uri);
      setVerificationCode("");
      setSetupMode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.twoFactorSetupError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifySetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const code = verificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError(t("settings.twoFactorCodeInvalid"));
      return;
    }
    setBusy(true);
    try {
      await verifyTOTPSetup({ code });
      await updateMFAPreference({ totp: "PREFERRED" });
      setSetupMode(false);
      setSetupSecret("");
      setSetupUri("");
      setVerificationCode("");
      setEnabled(true);
      setSuccess(t("settings.twoFactorEnabledSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.twoFactorVerifyError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await updateMFAPreference({ totp: "DISABLED" });
      setEnabled(false);
      setSetupMode(false);
      setSuccess(t("settings.twoFactorDisabledSuccess"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings.twoFactorDisableError"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <SettingsCardSkeleton />;
  }

  return (
    <SettingsCard
      icon={<ShieldCheck className="h-4 w-4" />}
      title={t("settings.twoFactorTitle")}
      description={t("settings.twoFactorDescription")}
      badge={
        <Badge variant={enabled ? "success" : "default"}>
          {enabled ? t("settings.twoFactorEnabled") : t("settings.twoFactorDisabled")}
        </Badge>
      }
    >
      {federated ? (
        <SettingsCallout>{t("settings.twoFactorFederated")}</SettingsCallout>
      ) : setupMode ? (
        <form onSubmit={handleVerifySetup} className="max-w-md space-y-4">
          <p className="text-sm text-secondary">{t("settings.twoFactorSetupHint")}</p>
          {setupUri ? (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <QrCodeImage
                data={setupUri}
                size={180}
                alt={t("settings.twoFactorQrAlt")}
              />
              <SettingsCallout title={t("settings.twoFactorSecretLabel")}>
                <code className="block break-all text-xs text-primary">{setupSecret}</code>
                <a href={setupUri} className="mt-2 inline-block text-xs text-accent hover:underline">
                  {t("settings.twoFactorOpenAuthenticator")}
                </a>
              </SettingsCallout>
            </div>
          ) : null}
          <div>
            <label htmlFor="totpCode" className="mb-1 block text-sm font-medium text-secondary">
              {t("settings.twoFactorCodeLabel")}
            </label>
            <Input
              id="totpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="123456"
              disabled={busy}
            />
          </div>
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setSetupMode(false);
                setSetupSecret("");
                setSetupUri("");
                setVerificationCode("");
                setError("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("auth.saving") : t("settings.twoFactorVerify")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          {success ? <p className="text-xs text-green-600">{success}</p> : null}
          {enabled ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleDisable()}>
              {busy ? t("auth.saving") : t("settings.twoFactorDisable")}
            </Button>
          ) : (
            <Button type="button" disabled={busy} onClick={() => void handleStartSetup()}>
              {busy ? t("auth.saving") : t("settings.twoFactorEnable")}
            </Button>
          )}
        </div>
      )}
    </SettingsCard>
  );
}
