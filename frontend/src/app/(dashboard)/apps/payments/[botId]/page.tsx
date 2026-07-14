"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context";
import { usePaymentsConfig, useSavePaymentsConfig } from "@/hooks/usePayments";
import type { PaymentsConfig } from "@/types";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { PaymentsWompiCredentialsForm } from "@/components/payments/PaymentsWompiCredentialsForm";
import { PaymentsConfigForm } from "@/components/payments/PaymentsConfigForm";
import { PaymentRequestsList } from "@/components/payments/PaymentRequestsList";

type Tab = "config" | "requests";

function parseTab(value: string | null): Tab {
  return value === "requests" ? "requests" : "config";
}

export default function PaymentsBotPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { botId } = useParams<{ botId: string }>();
  const [tab, setTab] = useState<Tab>(() => parseTab(searchParams.get("tab")));
  const [draft, setDraft] = useState<PaymentsConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { data, isLoading } = usePaymentsConfig(botId);
  const saveConfig = useSavePaymentsConfig(botId);

  useEffect(() => {
    if (data?.config) setDraft(data.config);
  }, [data]);

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  function selectTab(next: Tab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "config") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(`/apps/payments/${botId}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  async function handleSave() {
    if (!draft) return;
    setError("");
    setSaved(false);
    try {
      await saveConfig.mutateAsync({
        defaultAmountInCents: draft.defaultAmountInCents,
        paymentMessageTemplate: draft.paymentMessageTemplate,
        successRedirectUrl: draft.successRedirectUrl,
      });
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (isLoading || !draft) {
    return (
      <DashboardPage>
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </DashboardPage>
    );
  }

  return (
    <DashboardPage maxWidth="5xl">
      <PageHeader title={t("payments.manageTitle")} subtitle={t("payments.manageSubtitle")} />

      {!data?.wompiConfigured ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("payments.wompiRequired")}
        </p>
      ) : null}

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {(["config", "requests"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(`payments.tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === "config" ? (
        <div className="space-y-6">
          <PaymentsWompiCredentialsForm />
          <PaymentsConfigForm draft={draft} onChange={setDraft} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saveConfig.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {t("common.save")}
            </button>
            {saved ? <span className="text-sm text-green-600">{t("payments.saved")}</span> : null}
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
          </div>
        </div>
      ) : (
        <PaymentRequestsList botId={botId} />
      )}
    </DashboardPage>
  );
}
