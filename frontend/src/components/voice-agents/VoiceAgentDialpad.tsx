"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import {
  useEndTelephonyCall,
  useStartOutboundCall,
  useTelephonyCall,
  useTelephonySettings,
} from "@/hooks/useTelephony";
import { useT } from "@/i18n/context";
import { Button } from "@/components/ui/Button";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function formatTelephonyError(message: string, t: (key: string) => string): string {
  if (message.includes("10015") || message.includes("connection_id")) {
    return t("telephony.invalidConnectionId");
  }
  return message;
}

interface VoiceAgentDialpadProps {
  botId: string;
}

export function VoiceAgentDialpad({ botId }: VoiceAgentDialpadProps) {
  const t = useT();
  const { data: settings } = useTelephonySettings(botId);
  const startCall = useStartOutboundCall(botId);
  const endCall = useEndTelephonyCall(botId);

  const [digits, setDigits] = useState("");
  const [contactName, setContactName] = useState("");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data: activeCall } = useTelephonyCall(botId, activeCallId ?? undefined);

  const e164 = useMemo(() => {
    const trimmed = digits.trim();
    if (!trimmed) return "";
    return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  }, [digits]);

  const isLive =
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
    if (!settings?.telephonyEnabled) {
      setError(t("voiceAgents.testRequiresEnabled"));
      return;
    }
    if (!e164 || e164.length < 8) {
      setError(t("voiceAgents.testInvalidNumber"));
      return;
    }
    try {
      const result = await startCall.mutateAsync({
        to: e164,
        ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      });
      setActiveCallId(result.callId);
    } catch (err) {
      setError(formatTelephonyError((err as Error).message, t));
    }
  }

  async function handleHangup() {
    if (!activeCallId) return;
    try {
      await endCall.mutateAsync(activeCallId);
    } catch (err) {
      setError(formatTelephonyError((err as Error).message, t));
    }
  }

  return (
    <div className="content-card mx-auto max-w-md space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-primary">{t("voiceAgents.testTitle")}</h2>
        <p className="mt-1 text-sm text-secondary">{t("voiceAgents.testSubtitle")}</p>
      </div>

      <div className="rounded-xl border border-default bg-surface p-4">
        <input
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/[^\d+*#]/g, ""))}
          placeholder={t("voiceAgents.dialpadPlaceholder")}
          className="w-full border-0 bg-transparent text-center text-2xl font-semibold tracking-widest text-primary outline-none"
        />
        <p className="mt-1 text-center text-xs text-secondary">{e164 || "—"}</p>
      </div>

      <input
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        placeholder={t("telephony.contactNamePlaceholder")}
        className="w-full rounded-lg border border-default px-3 py-2 text-sm"
      />

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
          {t("voiceAgents.backspace")}
        </Button>
        {!isLive ? (
          <Button
            type="button"
            onClick={() => void handleCall()}
            disabled={startCall.isPending}
            className="flex-1"
          >
            <Phone className="mr-2 h-4 w-4" />
            {startCall.isPending ? t("telephony.calling") : t("telephony.startCall")}
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
            {t("voiceAgents.hangup")}
          </Button>
        )}
      </div>

      {activeCall && (
        <div className="rounded-lg border border-default bg-surface p-3 text-sm">
          <p className="font-medium text-primary">{t("voiceAgents.callStatus")}</p>
          <p className="text-secondary">{activeCall.status}</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
