"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession, updatePassword } from "aws-amplify/auth";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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

  return (
    <div className="bg-surface-elevated rounded-xl border border-default p-6">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="w-4 h-4 text-secondary" />
        <h2 className="font-semibold text-primary text-sm">{t("settings.changePasswordTitle")}</h2>
      </div>
      <p className="text-sm text-secondary mb-4">{t("settings.changePasswordDescription")}</p>

      {federated ? (
        <p className="text-sm text-secondary">{t("settings.changePasswordFederated")}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-secondary mb-1">
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
            <label htmlFor="newPassword" className="block text-sm font-medium text-secondary mb-1">
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
            <p className="mt-1 text-xs text-secondary">{getPasswordHint(t)}</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary mb-1">
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
    </div>
  );
}
