"use client";

import { useState } from "react";
import { useT } from "@/i18n/context";
import { useCreatePaymentRequest, usePaymentRequests } from "@/hooks/usePayments";
import type { PaymentRequest } from "@/types";

function formatCop(cents: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function statusClass(status: PaymentRequest["status"]): string {
  if (status === "paid") return "bg-green-100 text-green-800";
  if (status === "pending") return "bg-yellow-100 text-yellow-800";
  if (status === "declined") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

export function PaymentRequestsList({ botId }: { botId: string }) {
  const t = useT();
  const { data, isLoading } = usePaymentRequests(botId);
  const create = useCreatePaymentRequest(botId);
  const [showForm, setShowForm] = useState(false);
  const [contactPhone, setContactPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [amountInCents, setAmountInCents] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await create.mutateAsync({
        contactPhone,
        contactName: contactName || undefined,
        amountInCents: Number(amountInCents),
        description,
      });
      setShowForm(false);
      setContactPhone("");
      setContactName("");
      setAmountInCents("");
      setDescription("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const requests = data?.requests ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">{t("payments.requestsTitle")}</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {t("payments.createRequest")}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={(e) => void handleCreate(e)} className="mb-6 grid gap-3 sm:grid-cols-2">
          <input
            required
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder={t("payments.contactPhone")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder={t("payments.contactName")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            min={1000}
            value={amountInCents}
            onChange={(e) => setAmountInCents(e.target.value)}
            placeholder={t("payments.amountInCents")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("payments.description")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
            >
              {t("payments.sendLink")}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            >
              {t("common.cancel")}
            </button>
          </div>
          {error ? <p className="sm:col-span-2 text-sm text-red-600">{error}</p> : null}
        </form>
      ) : null}

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-500">{t("payments.noRequests")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">{t("payments.colContact")}</th>
                <th className="py-2 pr-4">{t("payments.colAmount")}</th>
                <th className="py-2 pr-4">{t("payments.colDescription")}</th>
                <th className="py-2 pr-4">{t("payments.colStatus")}</th>
                <th className="py-2">{t("payments.colDate")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req, index) => (
                <tr
                  key={req.paymentId ?? req.reference ?? `${req.createdAt}-${index}`}
                  className="border-b border-gray-100"
                >
                  <td className="py-2 pr-4">{req.contactPhone}</td>
                  <td className="py-2 pr-4">{formatCop(req.amountInCents)}</td>
                  <td className="py-2 pr-4">{req.description}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(req.status)}`}>
                      {t(`payments.status.${req.status}`)}
                    </span>
                  </td>
                  <td className="py-2">{new Date(req.createdAt).toLocaleString("es-CO")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
