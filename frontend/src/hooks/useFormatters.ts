"use client";

import { useCallback } from "react";
import { useLocale, useT } from "@/i18n/context";

export function useFormatters() {
  const locale = useLocale();
  const t = useT();
  const intlLocale = locale === "en" ? "en-US" : "es-ES";

  const formatDate = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return new Intl.DateTimeFormat(intlLocale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    },
    [intlLocale]
  );

  const formatRelativeTime = useCallback(
    (iso: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      const diff = Date.now() - d.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return t("common.now");
      if (minutes < 60) return t("common.minutesAgo", { count: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t("common.hoursAgo", { count: hours });
      const days = Math.floor(hours / 24);
      return t("common.daysAgo", { count: days });
    },
    [t]
  );

  const formatNumber = useCallback(
    (n: number) => new Intl.NumberFormat(intlLocale).format(n),
    [intlLocale]
  );

  const planLabel = useCallback(
    (plan: string) => {
      const labels: Record<string, string> = {
        free: t("common.planFree"),
        pro: t("common.planPro"),
        enterprise: t("common.planEnterprise"),
      };
      return labels[plan] ?? plan;
    },
    [t]
  );

  return { formatDate, formatRelativeTime, formatNumber, planLabel };
}
