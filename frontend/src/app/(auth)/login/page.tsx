"use client";

import { useState, useEffect } from "react";
import {
  signIn,
  confirmSignIn,
  signOut,
  getCurrentUser,
  resetPassword,
  confirmResetPassword,
} from "aws-amplify/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getPasswordHint, validateCognitoPassword } from "@/lib/passwordPolicy";
import { useT } from "@/i18n/context";
import { getPostLoginPath } from "@/lib/post-login-path";

function isUserAlreadyAuthenticatedError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "UserAlreadyAuthenticatedException"
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [missingAttrs, setMissingAttrs] = useState<string[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<
    "credentials" | "newPassword" | "forgotRequest" | "forgotConfirm"
  >("credentials");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(async () => {
        if (!cancelled) router.replace(await getPostLoginPath(redirectTo));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router, redirectTo]);

  function applySignInResult(
    out: Awaited<ReturnType<typeof signIn>>
  ): "done" | "newPassword" | "unsupported" {
    if (out.isSignedIn) {
      void getPostLoginPath(redirectTo).then((path) => router.push(path));
      return "done";
    }
    const step = out.nextStep?.signInStep;
    if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
      const missing = out.nextStep.missingAttributes ?? [];
      setMissingAttrs(missing);
      const initial: Record<string, string> = {};
      for (const k of missing) initial[k] = "";
      setAttrValues(initial);
      setNewPassword("");
      setConfirmNewPassword("");
      setPhase("newPassword");
      return "newPassword";
    }
    return "unsupported";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      let out: Awaited<ReturnType<typeof signIn>>;
      try {
        out = await signIn({ username: email, password });
      } catch (err) {
        if (isUserAlreadyAuthenticatedError(err)) {
          await signOut();
          out = await signIn({ username: email, password });
        } else {
          throw err;
        }
      }
      const result = applySignInResult(out);
      if (result === "unsupported") {
        setError(t("auth.unsupportedStep"));
      }
    } catch (err) {
      setError((err as Error).message ?? t("auth.signInError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmNewPassword) {
      setError(t("auth.newPasswordsMismatch"));
      return;
    }
    const pwdErr = validateCognitoPassword(newPassword, t);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    for (const k of missingAttrs) {
      if (!attrValues[k]?.trim()) {
        setError(t("auth.completeField", { field: k }));
        return;
      }
    }
    setLoading(true);
    try {
      const userAttributes =
        missingAttrs.length > 0
          ? Object.fromEntries(missingAttrs.map((k) => [k, attrValues[k].trim()]))
          : undefined;
      const out = await confirmSignIn({
        challengeResponse: newPassword,
        ...(userAttributes && Object.keys(userAttributes).length > 0
          ? { options: { userAttributes } }
          : {}),
      });
      if (out.isSignedIn) {
        router.push(await getPostLoginPath(redirectTo));
        return;
      }
      setError(t("auth.passwordChangeFailed"));
    } catch (err) {
      setError((err as Error).message ?? t("auth.setPasswordError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    if (!email.trim()) {
      setError(t("auth.enterEmail"));
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ username: email.trim() });
      setForgotCode("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
      setPhase("forgotConfirm");
    } catch (err) {
      setError((err as Error).message ?? t("auth.sendCodeError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    const pwdErr = validateCognitoPassword(forgotNewPassword, t);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    setLoading(true);
    try {
      await confirmResetPassword({
        username: email.trim(),
        confirmationCode: forgotCode.trim(),
        newPassword: forgotNewPassword,
      });
      setForgotCode("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
      setPassword("");
      setPhase("credentials");
      setSuccessMessage(t("auth.passwordUpdated"));
    } catch (err) {
      setError((err as Error).message ?? t("auth.resetError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendForgotCode() {
    setError("");
    setSuccessMessage("");
    if (!email.trim()) {
      setError(t("auth.enterEmail"));
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ username: email.trim() });
      setSuccessMessage(t("auth.codeResent"));
    } catch (err) {
      setError((err as Error).message ?? t("auth.resendError"));
    } finally {
      setLoading(false);
    }
  }

  if (phase === "newPassword") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("auth.newPassword")}</h2>
        <p className="text-sm text-gray-500 mb-6">{t("auth.newPasswordRequired")}</p>

        <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.newPassword")}
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">{getPasswordHint(t)}</p>
          </div>
          <div>
            <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              required
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {missingAttrs.map((key) => (
            <div key={key}>
              <label htmlFor={`attr-${key}`} className="block text-sm font-medium text-gray-700 mb-1">
                {key}
              </label>
              <input
                id={`attr-${key}`}
                type="text"
                required
                value={attrValues[key] ?? ""}
                onChange={(e) =>
                  setAttrValues((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          ))}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={async () => {
                setError("");
                setNewPassword("");
                setConfirmNewPassword("");
                try {
                  await signOut();
                } catch {
                  /* ignore */
                }
                setPhase("credentials");
              }}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
                loading
                  ? "bg-indigo-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
              )}
            >
              {loading ? t("auth.saving") : t("auth.continue")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (phase === "forgotRequest") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("auth.recoverPassword")}</h2>
        <p className="text-sm text-gray-500 mb-6">{t("auth.recoverBody")}</p>

        <form onSubmit={handleForgotRequest} className="space-y-4">
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
              {t("common.email")}
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder={t("auth.emailPlaceholder")}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setError("");
                setPhase("credentials");
              }}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
                loading
                  ? "bg-indigo-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
              )}
            >
              {loading ? t("auth.sending") : t("auth.sendCode")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (phase === "forgotConfirm") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("auth.newPassword")}</h2>
        <p className="text-sm text-gray-500 mb-6">{t("auth.forgotConfirmBody")}</p>

        <form onSubmit={handleForgotConfirm} className="space-y-4">
          <div>
            <label htmlFor="forgot-code" className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.verificationCode")}
            </label>
            <input
              id="forgot-code"
              type="text"
              required
              autoComplete="one-time-code"
              value={forgotCode}
              onChange={(e) => setForgotCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="123456"
            />
          </div>
          <div>
            <label htmlFor="forgot-new" className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.newPassword")}
            </label>
            <input
              id="forgot-new"
              type="password"
              required
              value={forgotNewPassword}
              onChange={(e) => setForgotNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">{getPasswordHint(t)}</p>
          </div>
          <div>
            <label htmlFor="forgot-confirm" className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="forgot-confirm"
              type="password"
              required
              value={forgotConfirmPassword}
              onChange={(e) => setForgotConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-sm text-emerald-800">{successMessage}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleResendForgotCode}
            disabled={loading}
            className="text-sm text-indigo-600 hover:underline disabled:opacity-50"
          >
            {t("auth.resendCode")}
          </button>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                setPhase("forgotRequest");
              }}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
                loading
                  ? "bg-indigo-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
              )}
            >
              {loading ? t("auth.saving") : t("auth.resetPassword")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">{t("auth.signIn")}</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            {t("common.email")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder={t("auth.emailPlaceholder")}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t("common.password")}
            </label>
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                setPhase("forgotRequest");
              }}
              className="text-sm text-indigo-600 hover:underline"
            >
              {t("auth.forgotPassword")}
            </button>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="text-sm text-emerald-800">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
            loading
              ? "bg-indigo-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
          )}
        >
          {loading ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t("auth.noAccount")}{" "}
        <Link href="/register" className="text-indigo-600 hover:underline font-medium">
          {t("auth.signUp")}
        </Link>
      </p>
    </div>
  );
}
