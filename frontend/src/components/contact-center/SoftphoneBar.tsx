"use client";

import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSoftphone } from "@/components/contact-center/SoftphoneProvider";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

export function SoftphoneBar() {
  const t = useT();
  const phone = useSoftphone();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-default bg-surface-elevated px-3 py-2 shadow-sm">
      <Phone className="h-4 w-4 text-accent" />
      <span className="text-xs font-medium text-secondary">{t("contactCenter.softphone")}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
          phone.status === "ready" || phone.status === "active"
            ? "bg-emerald-500/15 text-emerald-600"
            : phone.status === "ringing"
              ? "bg-amber-500/15 text-amber-700"
              : "bg-surface-muted text-muted"
        )}
      >
        {phone.status}
      </span>
      {phone.incoming?.from ? (
        <span className="text-xs text-primary">
          {t("contactCenter.caller")}: {phone.incoming.from}
        </span>
      ) : null}
      {phone.status === "idle" || phone.status === "error" ? (
        <Button size="sm" onClick={() => void phone.connect()}>
          {t("contactCenter.connect")}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={phone.disconnect}>
          {t("contactCenter.disconnect")}
        </Button>
      )}
      {phone.status === "ringing" ? (
        <>
          <Button size="sm" onClick={phone.answer}>
            {t("contactCenter.answer")}
          </Button>
          <Button size="sm" variant="danger" onClick={phone.reject}>
            {t("contactCenter.reject")}
          </Button>
        </>
      ) : null}
      {phone.status === "active" ? (
        <>
          <Button size="sm" variant="ghost" onClick={phone.toggleMute}>
            {phone.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {phone.muted ? t("contactCenter.unmute") : t("contactCenter.mute")}
          </Button>
          <Button size="sm" variant="danger" onClick={phone.hangup}>
            <PhoneOff className="h-4 w-4" />
            {t("contactCenter.hangup")}
          </Button>
        </>
      ) : null}
      {phone.error ? <span className="text-xs text-red-600">{phone.error}</span> : null}
    </div>
  );
}
