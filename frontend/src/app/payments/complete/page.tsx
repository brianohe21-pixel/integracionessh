"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";

function PaymentCompleteContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-default bg-surface-elevated p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-primary">{t("payments.completeTitle")}</h1>
        <p className="mt-2 text-sm text-secondary">{t("payments.completeMessage")}</p>
        {reference ? (
          <p className="mt-4 break-all text-xs text-muted">{reference}</p>
        ) : null}
      </div>
    </main>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-surface px-4">
          <div className="h-40 w-full max-w-md animate-pulse rounded-xl bg-surface-muted" />
        </main>
      }
    >
      <PaymentCompleteContent />
    </Suspense>
  );
}
