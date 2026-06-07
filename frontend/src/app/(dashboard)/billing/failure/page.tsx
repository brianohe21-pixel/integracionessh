"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { useT } from "@/i18n/context";

export default function BillingFailurePage() {
  const t = useT();

  return (
    <div className="p-8 max-w-lg mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900">{t("billing.failureTitle")}</h1>
        <p className="text-sm text-gray-500 mt-2">{t("billing.failureBody")}</p>
        <Link
          href="/billing"
          className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {t("billing.tryAgain")}
        </Link>
      </div>
    </div>
  );
}
