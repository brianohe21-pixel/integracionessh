"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { useSoftphone } from "@/components/contact-center/SoftphoneProvider";
import { Button } from "@/components/ui/Button";
import { usePrepareWebrtcOutbound } from "@/hooks/useContactCenter";
import { useEndTelephonyCall, useTelephonyCall } from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

interface ContactCenterDialpadProps {
  botId: string;
  fromNumber?: string;
}

export function ContactCenterDialpad({ botId, fromNumber }: ContactCenterDialpadProps) {
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
    <div className="content-card mx-auto max-w-md space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("contactCenter.dialTitle")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("contactCenter.dialSubtitleWebrtc")}</p>
        {fromNumber ? (
          <p className="mt-1 text-xs text-muted">
            {t("contactCenter.dialFrom")}: {fromNumber}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-default bg-surface p-4">
        <input
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/[^\d+*#]/g, ""))}
          placeholder={t("contactCenter.dialpadPlaceholder")}
          className="w-full border-0 bg-transparent text-center text-2xl font-semibold tracking-widest text-primary outline-none"
        />
        <p className="mt-1 text-center text-xs text-secondary">{e164 || "—"}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => appendDigit(key)}
            className="rounded-xl border border-default bg-surface-elevated py-4 text-lg font-semibold text-primary hover:bg-surface-muted"
          >
            {key}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={handleBackspace}>
          {t("contactCenter.backspace")}
        </Button>
        {!softphoneReady ? (
          <Button
            type="button"
            onClick={() => void phone.connect()}
            disabled={phone.status === "connecting"}
            className="flex-1"
          >
            {phone.status === "connecting" ? t("common.loading") : t("contactCenter.connect")}
          </Button>
        ) : !isLive ? (
          <Button
            type="button"
            onClick={() => void handleCall()}
            disabled={prepareOutbound.isPending || !botId}
            className="flex-1"
          >
            <Phone className="mr-2 h-4 w-4" />
            {prepareOutbound.isPending ? t("telephony.calling") : t("contactCenter.clickToCall")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="danger"
            onClick={() => void handleHangup()}
            disabled={endCall.isPending}
            className="flex-1"
          >
            <PhoneOff className="mr-2 h-4 w-4" />
            {t("contactCenter.hangup")}
          </Button>
        )}
      </div>

      {activeCall || phone.status === "dialing" || phone.status === "active" ? (
        <div className="rounded-lg border border-default bg-surface p-3 text-sm">
          <p className="font-medium text-primary">{t("contactCenter.callStatus")}</p>
          <div className="mt-2 space-y-1 text-xs">
            {activeCall ? (
              <p className="text-secondary">
                <span className="font-medium text-primary">{t("contactCenter.customerLine")}:</span>{" "}
                {activeCall.status === "ringing" || activeCall.status === "initiated"
                  ? t("contactCenter.customerRinging")
                  : activeCall.status === "accepted"
                    ? t("contactCenter.customerConnected")
                    : activeCall.status}
              </p>
            ) : null}
            <p className="text-secondary">
              <span className="font-medium text-primary">{t("contactCenter.softphone")}:</span>{" "}
              {phone.status === "dialing"
                ? t("contactCenter.softphoneDialing")
                : phone.status === "ready"
                  ? t("contactCenter.softphoneReady")
                  : phone.status === "ringing"
                    ? t("contactCenter.softphoneRinging")
                    : phone.status === "active"
                      ? t("contactCenter.softphoneInCall")
                      : phone.status}
            </p>
          </div>
          {phone.status === "dialing" ? (
            <p className="mt-2 text-xs text-sky-700">{t("contactCenter.dialingCustomer")}</p>
          ) : null}
          {phone.status === "active" ? (
            <p className="mt-2 text-xs text-secondary">{t("contactCenter.inCallHint")}</p>
          ) : null}
        </div>
      ) : null}

      {phone.error ? <p className="text-sm text-red-600">{phone.error}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
