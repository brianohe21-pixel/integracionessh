"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession, updatePassword } from "aws-amplify/auth";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SettingsCard, SettingsCardSkeleton } from "@/components/settings/SettingsCard";
import { getPasswordHint, validateCognitoPassword } from "@/lib/passwordPolicy";
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

function mapUpdatePasswordError(err: unknown, t: (key: string) => string): string {
  const name =
    typeof err === "object" && err !== null && "name" in err
      ? String((err as { name: string }).name)
      : "";
  const message = err instanceof Error ? err.message.toLowerCase() : "";

  if (
    name === "NotAuthorizedException" ||
    message.includes("incorrect") ||
    message.includes("not authorized")
  ) {
    return t("settings.changePasswordIncorrect");
  }
  if (name === "LimitExceededException" || message.includes("attempt limit")) {
    return t("settings.changePasswordLimit");
  }
  if (name === "InvalidPasswordException") {
    return t("auth.passwordHint");
  }
  if (
    message.includes("does not have a password") ||
    message.includes("cannot be reset") ||
    message.includes("external provider") ||
    message.includes("federated")
  ) {
    return t("settings.changePasswordFederated");
  }
  if (message.includes("same as previous") || message.includes("cannot be the same")) {
    return t("settings.changePasswordSame");
  }
  return t("settings.changePasswordError");
}

export function ChangePasswordCard() {
  const t = useT();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [federated, setFederated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const session = await fetchAuthSession();
        if (cancelled) return;
        const payload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;
        setFederated(hasFederatedIdentity(payload));
      } catch {
        if (!cancelled) setFederated(false);
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t("settings.changePasswordRequired"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("auth.newPasswordsMismatch"));
      return;
    }
    if (newPassword === currentPassword) {
      setError(t("settings.changePasswordSame"));
      return;
    }
    const pwdErr = validateCognitoPassword(newPassword, t);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }

    setLoading(true);
    try {
      await updatePassword({ oldPassword: currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(t("settings.changePasswordSuccess"));
    } catch (err) {
      setError(mapUpdatePasswordError(err, t));
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return <SettingsCardSkeleton lines={3} />;
  }

  return (
    <SettingsCard
      icon={<KeyRound className="h-4 w-4" />}
      title={t("settings.changePasswordTitle")}
      description={t("settings.changePasswordDescription")}
    >
      {federated ? (
        <p className="text-sm text-secondary">{t("settings.changePasswordFederated")}</p>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-md space-y-4">
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-secondary">
              {t("settings.currentPassword")}
            </label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-secondary">
              {t("auth.newPassword")}
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted">{getPasswordHint(t)}</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-secondary">
              {t("auth.confirmPassword")}
            </label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={loading}
            />
          </div>

          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          {success ? <p className="text-xs text-green-600">{success}</p> : null}

          <Button type="submit" disabled={loading}>
            {loading ? t("auth.saving") : t("settings.changePasswordSubmit")}
          </Button>
        </form>
      )}
    </SettingsCard>
  );
}
