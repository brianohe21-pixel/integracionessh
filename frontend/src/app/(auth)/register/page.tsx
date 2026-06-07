"use client";

import { useEffect, useState } from "react";
import { signUp, confirmSignUp } from "aws-amplify/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getPasswordHint, validateCognitoPassword } from "@/lib/passwordPolicy";
import { markPendingTermsAcceptance } from "@/components/legal/TermsAcceptanceSync";
import { storePendingBillingPlan } from "@/lib/post-login-path";
import { useT } from "@/i18n/context";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const t = useT();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (planParam === "pro" || planParam === "enterprise") {
      storePendingBillingPlan(planParam);
    }
  }, [planParam]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!acceptedTerms) {
      setError(t("legal.mustAccept"));
      return;
    }
    const pwdErr = validateCognitoPassword(password, t);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    setLoading(true);

    try {
      const tenantId = crypto.randomUUID();
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name,
            "custom:tenantId": tenantId,
            "custom:role": "member",
          },
        },
      });
      markPendingTermsAcceptance();
      setStep("confirm");
    } catch (err) {
      setError((err as Error).message ?? t("auth.registerError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      const billingRedirect =
        planParam === "pro" || planParam === "enterprise"
          ? `/billing?plan=${planParam}`
          : null;
      router.push(
        billingRedirect
          ? `/login?redirect=${encodeURIComponent(billingRedirect)}`
          : "/login"
      );
    } catch (err) {
      setError((err as Error).message ?? t("auth.invalidCode"));
    } finally {
      setLoading(false);
    }
  }

  if (step === "confirm") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("auth.confirmEmailTitle")}</h2>
        <p className="text-sm text-gray-500 mb-6">
          {t("auth.confirmEmailBody")} <strong>{email}</strong>
        </p>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.verificationCode")}
            </label>
            <input
              id="code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center tracking-widest text-lg"
              placeholder="000000"
              maxLength={6}
            />
          </div>

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
              loading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {loading ? t("auth.verifying") : t("auth.confirmAccount")}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">{t("auth.createAccount")}</h2>

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            {t("auth.companyName")}
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder={t("auth.companyPlaceholder")}
          />
        </div>

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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            {t("common.password")}
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder={t("auth.securePasswordPlaceholder")}
          />
          <p className="mt-1 text-xs text-gray-500">{getPasswordHint(t)}</p>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 rounded border-gray-300"
          />
          <span>
            {t("legal.acceptLabel")}{" "}
            <Link href="/legal/terms" target="_blank" className="text-indigo-600 hover:underline">
              {t("legal.footerTerms")}
            </Link>{" "}
            {t("legal.and")}{" "}
            <Link href="/legal/privacy" target="_blank" className="text-indigo-600 hover:underline">
              {t("legal.footerPrivacy")}
            </Link>
          </span>
        </label>

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
            loading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
          )}
        >
          {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {t("auth.hasAccount")}{" "}
        <Link
          href={
            planParam === "pro" || planParam === "enterprise"
              ? `/login?redirect=${encodeURIComponent(`/billing?plan=${planParam}`)}`
              : "/login"
          }
          className="text-indigo-600 hover:underline font-medium"
        >
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
