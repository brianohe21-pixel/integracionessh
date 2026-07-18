"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useT } from "@/i18n/context";
import { DashboardPage } from "@/components/layout/DashboardPage";

export default function BillingFailurePage() {
  const t = useT();

  return (
    <DashboardPage maxWidth="3xl">
      <div className="bg-surface-elevated rounded-xl border border-default p-6 sm:p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-primary">{t("billing.failureTitle")}</h1>
        <p className="text-sm text-secondary mt-2">{t("billing.failureBody")}</p>
        <Link
          href="/billing"
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          {t("billing.tryAgain")}
        </Link>
      </div>
    </DashboardPage>
  );
}
