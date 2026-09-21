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
        "topbar-icon relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        phone.status === "ringing"
          ? "bg-amber-400/20 text-amber-200"
          : phone.status === "dialing"
            ? "bg-sky-400/20 text-sky-200"
            : "text-white/90 hover:text-white"
      )}
    >
      <Phone className="h-4 w-4" />
      <span
        className={cn(
          "absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-[var(--topbar)]",
          statusDotClass(phone.status)
        )}
      />
    </button>
  );
}
