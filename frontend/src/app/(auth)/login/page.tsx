"use client";

import { useState, useEffect } from "react";
import {
  signIn,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
} from "aws-amplify/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getPasswordHint, validateCognitoPassword } from "@/lib/passwordPolicy";
import { useT } from "@/i18n/context";
import {
  billingPlanFromRedirect,
  billingRedirectForPlan,
  getPostLoginPath,
  isPaidBillingPlan,
  storePendingBillingPlan,
} from "@/lib/post-login-path";
import { signOutUser, ensureAuthSession } from "@/lib/auth-session";
import { useAuthSession } from "@/hooks/useAuthSession";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { MicrosoftSignInButton } from "@/components/auth/MicrosoftSignInButton";
import { validatePortalSession, getBrowserPortalHost, isRestrictedPortalHost } from "@/lib/host-portal";
import { usePublicAuthMethods } from "@/hooks/useMicrosoftSso";
import { isGoogleAuthConfigured } from "@/lib/amplify";
import { getDemoCredentials, isDemoLoginEnabled } from "@/lib/demo-access";

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
  const portalError = searchParams.get("error") === "portal";
  const planParam = searchParams.get("plan");
  const t = useT();

  const pendingPlan =
    (isPaidBillingPlan(planParam) ? planParam : null) ??
    billingPlanFromRedirect(redirectTo);

  const registerHref = pendingPlan
    ? `/register?plan=${pendingPlan}`
    : "/register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [missingAttrs, setMissingAttrs] = useState<string[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<
    "credentials" | "newPassword" | "forgotRequest" | "forgotConfirm" | "totp"
  >("credentials");
  const [totpCode, setTotpCode] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerAllowed, setRegisterAllowed] = useState(true);
  const [sessionRedirecting, setSessionRedirecting] = useState(false);
  const demoLoginEnabled = isDemoLoginEnabled();
  const { isAuthenticated, loading: authLoading } = useAuthSession();
  const portalHost = getBrowserPortalHost();
  const { data: authMethods } = usePublicAuthMethods(portalHost);
  const microsoftAuth = authMethods?.microsoft;
  const showPasswordLogin = authMethods?.password !== false;
  const showSocialLogin =
    isGoogleAuthConfigured() || Boolean(microsoftAuth?.enabled && microsoftAuth.providerName);

  useEffect(() => {
    if (pendingPlan) storePendingBillingPlan(pendingPlan);
  }, [pendingPlan]);

  useEffect(() => {
    if (portalError) {
      setError(t("auth.portalAccessDenied"));
    }
  }, [portalError, t]);

  useEffect(() => {
    const host = getBrowserPortalHost();
    if (!host) return;
    isRestrictedPortalHost(host)
      .then((restricted) => setRegisterAllowed(!restricted))
      .catch(() => setRegisterAllowed(true));
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    let cancelled = false;
    setSessionRedirecting(true);

    void (async () => {
      const portalCheck = await validatePortalSession();
      if (cancelled) return;
      if (!portalCheck.ok) {
        await signOutUser();
        setSessionRedirecting(false);
        setError(t(portalCheck.messageKey));
        return;
      }
      const target = redirectTo ?? (pendingPlan ? billingRedirectForPlan(pendingPlan) : null);
      router.replace(await getPostLoginPath(target));
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, router, redirectTo, pendingPlan, t]);

  async function finishLogin() {
    const portalCheck = await validatePortalSession();
    if (!portalCheck.ok) {
      await signOutUser();
      setError(t(portalCheck.messageKey));
      return false;
    }
    return true;
  }

  function applySignInResult(
    out: Awaited<ReturnType<typeof signIn>>
  ): "done" | "newPassword" | "totp" | "unsupported" {
    if (out.isSignedIn) {
      void (async () => {
        if (!(await finishLogin())) return;
        await ensureAuthSession();
        router.push(await getPostLoginPath(redirectTo));
      })();
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
    if (step === "CONFIRM_SIGN_IN_WITH_TOTP_CODE") {
      setTotpCode("");
      setPhase("totp");
      return "totp";
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
          await signOutUser();
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

  async function handleDemoLogin() {
    const credentials = getDemoCredentials();
    if (!credentials) return;

    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      let out: Awaited<ReturnType<typeof signIn>>;
      try {
        out = await signIn({
          username: credentials.email,
          password: credentials.password,
        });
      } catch (err) {
        if (isUserAlreadyAuthenticatedError(err)) {
          await signOutUser();
          out = await signIn({
            username: credentials.email,
            password: credentials.password,
          });
        } else {
          throw err;
        }
      }
      const result = applySignInResult(out);
      if (result === "unsupported") {
        setError(t("auth.unsupportedStep"));
      }
    } catch (err) {
      setError((err as Error).message ?? t("auth.demoLoginError"));
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
        if (!(await finishLogin())) return;
        await ensureAuthSession();
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

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const code = totpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError(t("settings.twoFactorCodeInvalid"));
      return;
    }
    setLoading(true);
    try {
      const out = await confirmSignIn({ challengeResponse: code });
      if (out.isSignedIn) {
        if (!(await finishLogin())) return;
        await ensureAuthSession();
        router.push(await getPostLoginPath(redirectTo));
        return;
      }
      setError(t("auth.twoFactorLoginError"));
    } catch (err) {
      setError((err as Error).message ?? t("auth.twoFactorLoginError"));
    } finally {
      setLoading(false);
    }
  }

  if (phase === "totp") {
    return (
      <div className="bg-surface-elevated rounded-2xl shadow-xl p-8 border border-subtle">
        <h2 className="text-xl font-semibold text-primary mb-2">{t("auth.twoFactorPrompt")}</h2>
        <p className="text-sm text-secondary mb-6">{t("auth.twoFactorLoginBody")}</p>

        <form onSubmit={handleTotpSubmit} className="space-y-4">
          <div>
            <label htmlFor="totp-login-code" className="block text-sm font-medium text-secondary mb-1">
              {t("settings.twoFactorCodeLabel")}
            </label>
            <input
              id="totp-login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="123456"
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
              onClick={async () => {
                setError("");
                setTotpCode("");
                try {
                  await signOutUser();
                } catch {
                  /* ignore */
                }
                setPhase("credentials");
              }}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border border-default text-secondary hover:bg-surface"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
                loading
                  ? "bg-accent/60 cursor-not-allowed"
                  : "bg-accent hover:bg-accent-hover active:bg-accent-hover"
              )}
            >
              {loading ? t("auth.signingIn") : t("auth.continue")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (phase === "newPassword") {
    return (
      <div className="bg-surface-elevated rounded-2xl shadow-xl p-8 border border-subtle">
        <h2 className="text-xl font-semibold text-primary mb-2">{t("auth.newPassword")}</h2>
        <p className="text-sm text-secondary mb-6">{t("auth.newPasswordRequired")}</p>

        <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-secondary mb-1">
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
              className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <p className="mt-1 text-xs text-secondary">{getPasswordHint(t)}</p>
          </div>
          <div>
            <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-secondary mb-1">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              required
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>

          {missingAttrs.map((key) => (
            <div key={key}>
              <label htmlFor={`attr-${key}`} className="block text-sm font-medium text-secondary mb-1">
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
                className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
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
                  await signOutUser();
                } catch {
                  /* ignore */
                }
                setPhase("credentials");
              }}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border border-default text-secondary hover:bg-surface"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
                loading
                  ? "bg-accent/60 cursor-not-allowed"
                  : "bg-accent hover:bg-accent-hover active:bg-accent-hover"
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
      <div className="bg-surface-elevated rounded-2xl shadow-xl p-8 border border-subtle">
        <h2 className="text-xl font-semibold text-primary mb-2">{t("auth.recoverPassword")}</h2>
        <p className="text-sm text-secondary mb-6">{t("auth.recoverBody")}</p>

        <form onSubmit={handleForgotRequest} className="space-y-4">
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-secondary mb-1">
              {t("common.email")}
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
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
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border border-default text-secondary hover:bg-surface"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
                loading
                  ? "bg-accent/60 cursor-not-allowed"
                  : "bg-accent hover:bg-accent-hover active:bg-accent-hover"
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
      <div className="bg-surface-elevated rounded-2xl shadow-xl p-8 border border-subtle">
        <h2 className="text-xl font-semibold text-primary mb-2">{t("auth.newPassword")}</h2>
        <p className="text-sm text-secondary mb-6">{t("auth.forgotConfirmBody")}</p>

        <form onSubmit={handleForgotConfirm} className="space-y-4">
          <div>
            <label htmlFor="forgot-code" className="block text-sm font-medium text-secondary mb-1">
              {t("auth.verificationCode")}
            </label>
            <input
              id="forgot-code"
              type="text"
              required
              autoComplete="one-time-code"
              value={forgotCode}
              onChange={(e) => setForgotCode(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="123456"
            />
          </div>
          <div>
            <label htmlFor="forgot-new" className="block text-sm font-medium text-secondary mb-1">
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
              className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <p className="mt-1 text-xs text-secondary">{getPasswordHint(t)}</p>
          </div>
          <div>
            <label htmlFor="forgot-confirm" className="block text-sm font-medium text-secondary mb-1">
              {t("auth.confirmPassword")}
            </label>
            <input
              id="forgot-confirm"
              type="password"
              required
              value={forgotConfirmPassword}
              onChange={(e) => setForgotConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
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
            className="text-sm text-accent hover:underline disabled:opacity-50"
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
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border border-default text-secondary hover:bg-surface"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
                loading
                  ? "bg-accent/60 cursor-not-allowed"
                  : "bg-accent hover:bg-accent-hover active:bg-accent-hover"
              )}
            >
              {loading ? t("auth.saving") : t("auth.resetPassword")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (authLoading || sessionRedirecting || isAuthenticated) {
    return null;
  }

  return (
    <div className="bg-surface-elevated rounded-2xl shadow-xl p-8 border border-subtle">
      <h2 className="text-xl font-semibold text-primary mb-6">{t("auth.signIn")}</h2>

      {microsoftAuth?.enabled && microsoftAuth.providerName ? (
        <MicrosoftSignInButton
          providerName={microsoftAuth.providerName}
          onError={setError}
        />
      ) : null}
      <GoogleSignInButton onError={setError} />
      {showSocialLogin ? <AuthDivider /> : null}

      {showPasswordLogin ? (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-secondary mb-1">
            {t("common.email")}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            placeholder={t("auth.emailPlaceholder")}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-secondary">
              {t("common.password")}
            </label>
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                setPhase("forgotRequest");
              }}
              className="text-sm text-accent hover:underline"
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
            className="w-full px-3 py-2 border border-default rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
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
              ? "bg-accent/60 cursor-not-allowed"
              : "bg-accent hover:bg-accent-hover active:bg-accent-hover"
          )}
        >
          {loading ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>
      ) : null}

      {demoLoginEnabled ? (
        <div className="mt-6 space-y-3">
          <AuthDivider label={t("auth.demoDivider")} />
          <button
            type="button"
            onClick={() => void handleDemoLogin()}
            disabled={loading}
            className={cn(
              "w-full py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors",
              loading
                ? "border-default text-secondary cursor-not-allowed opacity-60"
                : "border-accent text-accent hover:bg-accent/5"
            )}
          >
            {loading ? t("auth.demoSigningIn") : t("auth.demoLogin")}
          </button>
          <p className="text-center text-xs text-secondary">{t("auth.demoLoginHint")}</p>
        </div>
      ) : null}

      <p className="text-center text-sm text-secondary mt-6">
        {registerAllowed ? (
          <>
            {t("auth.noAccount")}{" "}
            <Link href={registerHref} className="text-accent hover:underline font-medium">
              {t("auth.signUp")}
            </Link>
          </>
        ) : (
          t("auth.registerDisabledOnPortal")
        )}
      </p>
    </div>
  );
}
