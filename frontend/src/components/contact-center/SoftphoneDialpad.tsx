"use client";

import { useEffect, useMemo, useState } from "react";
import { Delete, Phone, PhoneOff } from "lucide-react";
import { useSoftphone } from "@/components/contact-center/SoftphoneProvider";
import { Button } from "@/components/ui/Button";
import { usePrepareWebrtcOutbound } from "@/hooks/useContactCenter";
import { useEndTelephonyCall, useTelephonyCall } from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

interface SoftphoneDialpadProps {
  botId: string;
  fromNumber?: string;
  compact?: boolean;
  showHeader?: boolean;
  className?: string;
}

export function SoftphoneDialpad({
  botId,
  fromNumber,
  compact = false,
  showHeader = false,
  className,
}: SoftphoneDialpadProps) {
  const t = useT();
  const phone = useSoftphone();
  const prepareOutbound = usePrepareWebrtcOutbound();
  const endCall = useEndTelephonyCall(botId);

  const [digits, setDigits] = useState("");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data: activeCall } = useTelephonyCall(botId, activeCallId ?? undefined);

  const e164 = useMemo(() => {
    const trimmed = digits.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  }, [digits]);

  const softphoneReady =
    phone.status === "ready" ||
    phone.status === "active" ||
    phone.status === "ringing" ||
    phone.status === "dialing";
  const isLive =
    phone.status === "active" ||
    phone.status === "dialing" ||
    phone.status === "ringing" ||
    activeCall?.status === "initiated" ||
    activeCall?.status === "ringing" ||
    activeCall?.status === "accepted";

  useEffect(() => {
    if (
      activeCall?.status === "completed" ||
      activeCall?.status === "failed" ||
      activeCall?.status === "terminated" ||
      activeCall?.status === "rejected" ||
      activeCall?.status === "voicemail"
    ) {
      const timer = setTimeout(() => setActiveCallId(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [activeCall?.status]);

  function appendDigit(digit: string) {
    setDigits((prev) => `${prev}${digit}`);
  }

  function handleBackspace() {
    setDigits((prev) => prev.slice(0, -1));
  }

  async function handleCall() {
    setError("");
    if (!botId) {
      setError(t("contactCenter.dialNoBot"));
      return;
    }
    if (!softphoneReady) {
      setError(t("contactCenter.dialConnectFirst"));
      return;
    }
    if (!e164 || e164.length < 8) {
      setError(t("contactCenter.dialInvalidNumber"));
      return;
    }
    try {
      const prep = await prepareOutbound.mutateAsync({ botId, to: e164 });
      setActiveCallId(prep.callId);
      phone.dial({
        to: e164,
        callerNumber: prep.callerNumber,
        clientState: prep.clientState,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleHangup() {
    setError("");
    phone.hangup();
    if (!activeCallId) return;
    try {
      await endCall.mutateAsync(activeCallId);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {showHeader ? (
        <div>
          <h2 className="text-lg font-semibold text-primary">{t("contactCenter.dialTitle")}</h2>
          <p className="mt-1 text-sm text-secondary">{t("contactCenter.dialSubtitleWebrtc")}</p>
          {fromNumber ? (
            <p className="mt-1 text-xs text-muted">
              {t("contactCenter.dialFrom")}: {fromNumber}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={cn("rounded-xl border border-default bg-surface", compact ? "p-3" : "p-4")}>
        <input
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/[^\d+*#]/g, ""))}
          placeholder={t("contactCenter.dialpadPlaceholder")}
          className={cn(
            "w-full border-0 bg-transparent text-center font-semibold tracking-widest text-primary outline-none",
            compact ? "text-xl" : "text-2xl"
          )}
        />
        <p className="mt-1 text-center text-xs text-secondary">{e164 || "—"}</p>
      </div>

      <div className={cn("grid grid-cols-3", compact ? "gap-2" : "gap-3")}>
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => appendDigit(key)}
            className={cn(
              "rounded-xl border border-default bg-surface-elevated font-semibold text-primary transition-colors hover:bg-surface-muted",
              compact ? "py-2.5 text-base" : "py-4 text-lg"
            )}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size={compact ? "sm" : "md"}
          onClick={handleBackspace}
          aria-label={t("contactCenter.backspace")}
        >
          <Delete className="h-4 w-4" />
        </Button>
        {!isLive ? (
          <Button
            type="button"
            size={compact ? "sm" : "md"}
            className="flex-1"
            onClick={() => void handleCall()}
            disabled={prepareOutbound.isPending || !botId || !softphoneReady}
          >
            <Phone className="h-4 w-4" />
            {prepareOutbound.isPending ? t("telephony.calling") : t("contactCenter.clickToCall")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="danger"
            size={compact ? "sm" : "md"}
            className="flex-1"
            onClick={() => void handleHangup()}
            disabled={endCall.isPending}
          >
            <PhoneOff className="h-4 w-4" />
            {t("contactCenter.hangup")}
          </Button>
        )}
      </div>

      {phone.error ? <p className="text-xs text-danger">{phone.error}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {!softphoneReady ? (
        <p className="text-xs text-secondary">{t("contactCenter.dialConnectFirst")}</p>
      ) : null}
    </div>
  );
}
