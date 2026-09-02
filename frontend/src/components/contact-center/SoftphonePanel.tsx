"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { SoftphoneDialpad } from "@/components/contact-center/SoftphoneDialpad";
import { useSoftphone } from "@/components/contact-center/SoftphoneProvider";
import { useBots } from "@/hooks/useBots";
import { useT } from "@/i18n/context";
import { getOutboundCallableBots, resolveOutboundBotId } from "@/lib/voice-bots";
import { cn } from "@/lib/utils";

const BOT_STORAGE_KEY = "softphone-bot-id";

export function SoftphonePanel() {
  const t = useT();
  const phone = useSoftphone();
  const { data: bots = [], isLoading: botsLoading } = useBots();
  const callableBots = useMemo(() => getOutboundCallableBots(bots), [bots]);
  const [preferredBotId, setPreferredBotId] = useState<string | null>(null);
  const botId = useMemo(
    () => resolveOutboundBotId(bots, preferredBotId),
    [bots, preferredBotId]
  );

  useEffect(() => {
    if (!botId) return;
    window.localStorage.setItem(BOT_STORAGE_KEY, botId);
  }, [botId]);

  const inCall =
    phone.status === "ringing" || phone.status === "dialing" || phone.status === "active";

  function handleBotChange(nextBotId: string) {
    setPreferredBotId(nextBotId);
    window.localStorage.setItem(BOT_STORAGE_KEY, nextBotId);
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "border-b px-4 py-3",
          phone.status === "ringing"
            ? "border-amber-400/40 bg-amber-50 dark:bg-amber-950/30"
            : phone.status === "dialing"
              ? "border-sky-400/40 bg-sky-50 dark:bg-sky-950/30"
              : "border-default bg-surface-muted/40"
        )}
      >
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-primary">{t("contactCenter.softphone")}</span>
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
              phone.status === "ready" || phone.status === "active"
                ? "bg-emerald-500/15 text-emerald-600"
                : phone.status === "ringing" || phone.status === "dialing"
                  ? "bg-amber-500/15 text-amber-700"
                  : "bg-surface-muted text-muted"
            )}
          >
            {phone.status}
          </span>
        </div>
        {phone.incoming?.remote ? (
          <p className="mt-2 text-xs text-secondary">
            {phone.callDirection === "outbound"
              ? `${t("contactCenter.dialTo")}: ${phone.incoming.remote}`
              : `${t("contactCenter.caller")}: ${phone.incoming.remote}`}
          </p>
        ) : null}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {phone.status === "idle" || phone.status === "error" ? (
          <Button className="w-full" size="sm" onClick={() => void phone.connect()}>
            <Phone className="h-4 w-4" />
            {t("contactCenter.connect")}
          </Button>
        ) : phone.status !== "connecting" ? (
          <Button className="w-full" size="sm" variant="secondary" onClick={phone.disconnect}>
            {t("contactCenter.disconnect")}
          </Button>
        ) : null}

        {phone.status === "ringing" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={phone.answer}>
              {t("contactCenter.answer")}
            </Button>
            <Button size="sm" variant="danger" onClick={phone.reject}>
              {t("contactCenter.reject")}
            </Button>
          </div>
        ) : null}

        {phone.status === "dialing" ? (
          <Button className="w-full" size="sm" variant="danger" onClick={phone.hangup}>
            <PhoneOff className="h-4 w-4" />
            {t("contactCenter.hangup")}
          </Button>
        ) : null}

        {phone.status === "active" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="ghost" onClick={phone.toggleMute}>
              {phone.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {phone.muted ? t("contactCenter.unmute") : t("contactCenter.mute")}
            </Button>
            <Button size="sm" variant="danger" onClick={phone.hangup}>
              <PhoneOff className="h-4 w-4" />
              {t("contactCenter.hangup")}
            </Button>
          </div>
        ) : null}

        {inCall ? (
          <div className="space-y-1 text-xs text-secondary">
            {phone.status === "dialing" ? (
              <p className="text-sky-700">{t("contactCenter.dialingCustomer")}</p>
            ) : null}
            {phone.status === "ringing" ? (
              <p className="text-amber-700">{t("contactCenter.answerToTalk")}</p>
            ) : null}
            {phone.status === "active" ? <p>{t("contactCenter.inCallHint")}</p> : null}
          </div>
        ) : (
          <>
            {botsLoading ? (
              <p className="text-xs text-secondary">{t("common.loading")}</p>
            ) : callableBots.length > 0 ? (
              <>
                {callableBots.length > 1 ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-secondary">
                      {t("contactCenter.dialBotLabel")}
                    </label>
                    <Select value={botId} onChange={(event) => handleBotChange(event.target.value)}>
                      {callableBots.map((bot) => (
                        <option key={bot.botId} value={bot.botId}>
                          {bot.name}
                          {bot.telephonyPhoneNumber ? ` (${bot.telephonyPhoneNumber})` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <p className="text-xs text-secondary">
                    {t("contactCenter.dialFrom")}: {callableBots[0]!.name}
                    {callableBots[0]!.telephonyPhoneNumber
                      ? ` · ${callableBots[0]!.telephonyPhoneNumber}`
                      : ""}
                  </p>
                )}

                <SoftphoneDialpad botId={botId} compact />

                {phone.status === "ready" ? (
                  <p className="text-xs text-secondary">{t("contactCenter.mySoftphoneReady")}</p>
                ) : null}
              </>
            ) : phone.status === "ready" ? (
              <div className="space-y-2 rounded-xl border border-default bg-surface-muted/40 p-3 text-xs text-secondary">
                <p>{t("contactCenter.softphoneInboundOnly")}</p>
                <p>{t("contactCenter.softphoneOutboundSetup")}</p>
                <Link
                  href="/voice-agents"
                  className="inline-flex font-medium text-accent hover:underline"
                >
                  {t("contactCenter.openVoiceAgents")}
                </Link>
              </div>
            ) : (
              <p className="text-xs text-secondary">{t("contactCenter.softphoneOutboundSetup")}</p>
            )}
          </>
        )}

        {phone.error ? <p className="text-sm text-danger">{phone.error}</p> : null}
      </div>
    </div>
  );
}
