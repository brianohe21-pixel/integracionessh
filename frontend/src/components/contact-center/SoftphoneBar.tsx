"use client";

import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSoftphone } from "@/components/contact-center/SoftphoneProvider";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tenant } from "@/types";
import { isSubaccountServiceEnabled } from "@/lib/subaccount-services";
import { useAdminRole } from "@/hooks/useAdminRole";

export function SoftphoneBar() {
  const t = useT();
  const phone = useSoftphone();
  const { isAdmin } = useAdminRole();
  const { data: me } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: !isAdmin,
  });

  if (!isSubaccountServiceEnabled(me, "contactCenter")) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 shadow-sm",
        phone.status === "ringing"
          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40"
          : phone.status === "dialing"
            ? "border-sky-400 bg-sky-50 dark:bg-sky-950/40"
            : "border-default bg-surface-elevated"
      )}
    >
      <Phone className="h-4 w-4 text-accent" />
      <span className="text-xs font-medium text-secondary">{t("contactCenter.softphone")}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
          phone.status === "ready" || phone.status === "active"
            ? "bg-emerald-500/15 text-emerald-600"
            : phone.status === "ringing" || phone.status === "dialing"
              ? "bg-amber-500/15 text-amber-700"
              : "bg-surface-muted text-muted"
        )}
      >
        {phone.status}
      </span>
      {phone.incoming?.remote ? (
        <span className="text-xs text-primary">
          {phone.callDirection === "outbound"
            ? `${t("contactCenter.dialTo")}: ${phone.incoming.remote}`
            : `${t("contactCenter.caller")}: ${phone.incoming.remote}`}
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
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={phone.answer}>
            {t("contactCenter.answer")}
          </Button>
          <Button size="sm" variant="danger" onClick={phone.reject}>
            {t("contactCenter.reject")}
          </Button>
        </>
      ) : null}
      {phone.status === "dialing" ? (
        <Button size="sm" variant="danger" onClick={phone.hangup}>
          <PhoneOff className="h-4 w-4" />
          {t("contactCenter.hangup")}
        </Button>
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
      {phone.status === "dialing" ? (
        <span className="text-xs text-sky-700">{t("contactCenter.dialingCustomer")}</span>
      ) : null}
      {phone.status === "ringing" ? (
        <span className="text-xs text-amber-700">{t("contactCenter.answerToTalk")}</span>
      ) : null}
      {phone.status === "active" ? (
        <span className="text-xs text-secondary">{t("contactCenter.inCallHint")}</span>
      ) : null}
      {phone.error ? <span className="text-xs text-red-600">{phone.error}</span> : null}
    </div>
  );
}
