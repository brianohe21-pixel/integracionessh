"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";

function PaymentCompleteContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">{t("payments.completeTitle")}</h1>
        <p className="mt-2 text-sm text-gray-600">{t("payments.completeMessage")}</p>
        {reference ? (
          <p className="mt-4 break-all text-xs text-gray-400">{reference}</p>
        ) : null}
      </div>
    </main>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <div className="h-40 w-full max-w-md animate-pulse rounded-xl bg-gray-100" />
        </main>
      }
    >
      <PaymentCompleteContent />
    </Suspense>
  );
}
