"use client";

import { Phone } from "lucide-react";
import { useSoftphone } from "@/components/contact-center/SoftphoneProvider";
import { useSoftphoneUI } from "@/components/contact-center/SoftphoneUIProvider";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";

function statusDotClass(status: ReturnType<typeof useSoftphone>["status"]) {
  if (status === "ready" || status === "active") return "bg-emerald-500";
  if (status === "ringing" || status === "dialing") return "bg-amber-500 animate-pulse";
  if (status === "connecting") return "bg-sky-500 animate-pulse";
  if (status === "error") return "bg-red-500";
  return "bg-muted";
}

export function SoftphoneTrigger() {
  const t = useT();
  const phone = useSoftphone();
  const { open, toggleOpen } = useSoftphoneUI();

  return (
    <button
      type="button"
      onClick={toggleOpen}
      aria-label={t("contactCenter.openSoftphone")}
      aria-expanded={open}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors",
        phone.status === "ringing"
          ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/40"
          : phone.status === "dialing"
            ? "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-950/40"
            : "border-default bg-surface-elevated text-accent hover:bg-surface-muted"
      )}
    >
      <Phone className="h-4 w-4" />
      <span
        className={cn(
          "absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-surface-elevated",
          statusDotClass(phone.status)
        )}
      />
    </button>
  );
}
