"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useBots } from "@/hooks/useBots";
import { useSendSmsOtp, useVerifySmsOtp } from "@/hooks/useSmsOtp";
import { useT } from "@/i18n/context";
import { useFormatters } from "@/hooks/useFormatters";
import { EmptyState } from "@/components/ui/EmptyState";

const DEFAULT_MESSAGE = "Tu codigo de verificacion es {{code}}. Expira en 5 minutos.";

export function SmsOtpTab() {
  const t = useT();
  const { formatDate } = useFormatters();
  const { data: bots = [] } = useBots();
  const sendMutation = useSendSmsOtp();
  const verifyMutation = useVerifySmsOtp();

  const smsBots = useMemo(() => bots.filter((bot) => bot.smsEnabled), [bots]);
  const configureSmsHref = useMemo(() => {
    if (bots.length === 1) {
      return `/bots/${bots[0].botId}/edit?tab=sms`;
    }
    return "/bots";
  }, [bots]);
  const [botId, setBotId] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [maxAttempts, setMaxAttempts] = useState("3");
  const [code, setCode] = useState("");
  const [sendResult, setSendResult] = useState<Awaited<ReturnType<typeof sendMutation.mutateAsync>> | null>(null);
  const [verifyResult, setVerifyResult] = useState<Awaited<ReturnType<typeof verifyMutation.mutateAsync>> | null>(null);
  const [sendError, setSendError] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const verifyPhone = useMemo(
    () => (sendResult?.destination ?? to).replace(/\D/g, ""),
    [sendResult?.destination, to]
  );
  const verifyCode = useMemo(() => code.replace(/\D/g, ""), [code]);
  const canVerify = verifyPhone.length >= 7 && verifyCode.length >= 4;

  useEffect(() => {
    if (!botId && smsBots.length === 1) {
      setBotId(smsBots[0].botId);
    }
  }, [botId, smsBots]);

  useEffect(() => {
    if (sendResult?.destination) {
      setTo(sendResult.destination);
    }
  }, [sendResult?.destination]);

  async function handleSend() {
    if (!botId || !to.trim()) return;
    setSendError("");
    setSendResult(null);
    setVerifyResult(null);
    setVerifyError("");
    try {
      const parsedMaxAttempts = Number.parseInt(maxAttempts, 10);
      const result = await sendMutation.mutateAsync({
        botId,
        to: to.replace(/\D/g, ""),
        message: message.trim() || DEFAULT_MESSAGE,
        ...(Number.isFinite(parsedMaxAttempts) ? { maxAttempts: parsedMaxAttempts } : {}),
      });
      setSendResult(result);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : t("smsDashboard.otp.sendFailed"));
    }
  }

  async function handleVerify() {
    if (verifyPhone.length < 7) {
      setVerifyError(t("smsDashboard.otp.verifyPhoneRequired"));
      return;
    }
    if (verifyCode.length < 4) {
      setVerifyError(t("smsDashboard.otp.verifyCodeRequired"));
      return;
    }

    setVerifyError("");
    setVerifyResult(null);
    try {
      const result = await verifyMutation.mutateAsync({
        to: verifyPhone,
        code: verifyCode,
      });
      setVerifyResult(result);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : t("smsDashboard.otp.verifyFailed"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-primary">{t("smsDashboard.otp.title")}</h2>
        <p className="mt-1 text-xs text-secondary">{t("smsDashboard.otp.subtitle")}</p>
      </div>

      {bots.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-7 w-7" />}
          title={t("smsDashboard.otp.noAgentsTitle")}
          description={t("smsDashboard.otp.noAgentsHint")}
          action={
            <Link
              href="/bots/new"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              {t("smsDashboard.otp.createAgent")}
            </Link>
          }
        />
      ) : smsBots.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-7 w-7" />}
          title={t("smsDashboard.otp.noSmsAgentsTitle")}
          description={t("smsDashboard.otp.noSmsAgentsHint")}
          action={
            <Link
              href={configureSmsHref}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              {t("smsDashboard.otp.configureSms")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl border border-default bg-surface-elevated p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <h3 className="font-medium text-primary">{t("smsDashboard.otp.sendTitle")}</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t("outreach.agent")}
                </label>
                <select
                  value={botId}
                  onChange={(e) => setBotId(e.target.value)}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
                >
                  <option value="">{t("outreach.selectAgent")}</option>
                  {smsBots.map((bot) => (
                    <option key={bot.botId} value={bot.botId}>
                      {bot.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t("smsDashboard.otp.phone")}
                </label>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="573001234567"
                  className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t("smsDashboard.otp.message")}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t("smsDashboard.otp.maxAttempts")}
                </label>
                <input
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
                />
              </div>

              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sendMutation.isPending || !botId || !to.trim()}
                className="inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {sendMutation.isPending ? t("smsDashboard.otp.sending") : t("smsDashboard.otp.sendAction")}
              </button>

              {sendError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {sendError}
                </div>
              ) : null}

              {sendResult ? (
                <div className="rounded-lg border border-default bg-surface px-3 py-2.5 text-sm text-secondary">
                  <p className="font-medium text-primary">{t("smsDashboard.otp.sendSuccess")}</p>
                  <p className="mt-1.5">{t("smsDashboard.otp.destination")}: {sendResult.destination}</p>
                  <p>{t("smsDashboard.otp.expiresAt")}: {formatDate(sendResult.expiresAt)}</p>
                  {sendResult.traceId ? (
                    <p>
                      {t("smsDashboard.otp.traceId")}: {sendResult.traceId}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-default bg-surface-elevated p-5">
            <h3 className="mb-4 font-medium text-primary">{t("smsDashboard.otp.verifyTitle")}</h3>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleVerify();
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t("smsDashboard.otp.phone")}
                </label>
                <input
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setVerifyResult(null);
                    setVerifyError("");
                  }}
                  placeholder="573001234567"
                  className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary"
                />
                {sendResult?.destination ? (
                  <p className="mt-1 text-xs text-secondary">
                    {t("smsDashboard.otp.verifyPhoneHint", { phone: sendResult.destination })}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t("smsDashboard.otp.code")}
                </label>
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setVerifyResult(null);
                    setVerifyError("");
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={10}
                  className="w-full rounded-lg border border-default bg-surface px-3 py-2 text-center text-lg font-semibold tracking-[0.3em] text-primary"
                />
              </div>

              <button
                type="submit"
                disabled={verifyMutation.isPending || !canVerify}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {verifyMutation.isPending ? t("smsDashboard.otp.verifying") : t("smsDashboard.otp.verifyAction")}
              </button>

              {!canVerify && !verifyError && !verifyResult ? (
                <p className="text-xs text-secondary">{t("smsDashboard.otp.verifyFieldsHint")}</p>
              ) : null}

              {verifyError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {verifyError}
                </div>
              ) : null}

              {verifyResult ? (
                <div
                  className={`rounded-lg border px-3 py-2.5 text-sm ${
                    verifyResult.verified
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                >
                  <p className="font-medium">
                    {verifyResult.verified
                      ? t("smsDashboard.otp.verifySuccess")
                      : t(`smsDashboard.otp.reason.${verifyResult.reason}`)}
                  </p>
                  {verifyResult.attemptsRemaining !== undefined ? (
                    <p className="mt-1.5">
                      {t("smsDashboard.otp.attemptsRemaining", {
                        count: verifyResult.attemptsRemaining,
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
