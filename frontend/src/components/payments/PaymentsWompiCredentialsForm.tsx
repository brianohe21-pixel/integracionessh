"use client";

import { useState } from "react";
import { useT } from "@/i18n/context";
import {
  useDeleteWompiCredentials,
  useSaveWompiCredentials,
  useWompiCredentials,
} from "@/hooks/usePayments";

export function PaymentsWompiCredentialsForm() {
  const t = useT();
  const { data, isLoading } = useWompiCredentials();
  const save = useSaveWompiCredentials();
  const remove = useDeleteWompiCredentials();
  const [publicKey, setPublicKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [integritySecret, setIntegritySecret] = useState("");
  const [eventsSecret, setEventsSecret] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
  const webhookUrl = data?.tenantId
    ? `${apiBase}/payments/wompi/webhook/${data.tenantId}`
    : "";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      await save.mutateAsync({ publicKey, privateKey, integritySecret, eventsSecret });
      setSaved(true);
      setPublicKey("");
      setPrivateKey("");
      setIntegritySecret("");
      setEventsSecret("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-gray-100" />;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900">{t("payments.wompiTitle")}</h2>
      <p className="mt-1 text-sm text-gray-500">{t("payments.wompiSubtitle")}</p>

      {data?.configured ? (
        <p className="mt-3 text-sm text-green-700">{t("payments.wompiConfigured")}</p>
      ) : (
        <p className="mt-3 text-sm text-amber-700">{t("payments.wompiNotConfigured")}</p>
      )}

      {webhookUrl ? (
        <div className="mt-4 rounded-lg bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-600">{t("payments.webhookUrl")}</p>
          <code className="mt-1 block break-all text-xs text-gray-800">{webhookUrl}</code>
        </div>
      ) : null}

      <form onSubmit={(e) => void handleSave(e)} className="mt-4 space-y-3">
        {(
          [
            ["publicKey", publicKey, setPublicKey, t("payments.publicKey")],
            ["privateKey", privateKey, setPrivateKey, t("payments.privateKey")],
            ["integritySecret", integritySecret, setIntegritySecret, t("payments.integritySecret")],
            ["eventsSecret", eventsSecret, setEventsSecret, t("payments.eventsSecret")],
          ] as const
        ).map(([key, value, setter, label]) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
            <input
              type="password"
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            {t("payments.saveCredentials")}
          </button>
          {data?.configured ? (
            <button
              type="button"
              onClick={() => void remove.mutateAsync()}
              disabled={remove.isPending}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              {t("payments.deleteCredentials")}
            </button>
          ) : null}
        </div>
        {saved ? <p className="text-sm text-green-600">{t("payments.saved")}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </div>
  );
}
