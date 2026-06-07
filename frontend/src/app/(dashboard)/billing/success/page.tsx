"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  useBillingTransaction,
  useConfirmWompiPayment,
} from "@/hooks/useBilling";
import { useT } from "@/i18n/context";

export default function BillingSuccessPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const transactionId = searchParams.get("id");
  const { data: transaction, isLoading } = useBillingTransaction(reference);
  const confirmWompi = useConfirmWompiPayment();
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [confirmError, setConfirmError] = useState(false);

  useEffect(() => {
    if (!transactionId || !reference || confirmAttempted) return;
    if (transaction?.status === "approved") return;

    setConfirmAttempted(true);
    confirmWompi
      .mutateAsync({ id: transactionId, reference })
      .catch(() => setConfirmError(true));
  }, [transactionId, reference, transaction?.status, confirmAttempted, confirmWompi]);

  const approved = transaction?.status === "approved";
  const declined = transaction?.status === "declined";
  const pending = isLoading || transaction?.status === "pending" || confirmWompi.isPending;

  return (
    <div className="p-8 max-w-lg mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        {pending && !declined && (
          <>
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900">{t("billing.successPendingTitle")}</h1>
            <p className="text-sm text-gray-500 mt-2">{t("billing.successPendingBody")}</p>
          </>
        )}

        {approved && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900">{t("billing.wompiSuccess")}</h1>
            <p className="text-sm text-gray-500 mt-2">{t("billing.successActiveBody")}</p>
          </>
        )}

        {(declined || confirmError) && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900">{t("billing.successFailedTitle")}</h1>
            <p className="text-sm text-gray-500 mt-2">
              {confirmError ? t("billing.wompiConfirmError") : t("billing.successFailedBody")}
            </p>
          </>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/billing"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("billing.backToBilling")}
          </Link>
          <Link href="/bots" className="text-sm text-gray-500 hover:text-gray-700">
            {t("billing.goToDashboard")}
          </Link>
        </div>
      </div>
    </div>
  );
}
