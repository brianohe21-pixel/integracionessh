"use client";

import { useState } from "react";
import { useT } from "@/i18n/context";
import { useCatalogOrders, useUpdateCatalogOrder } from "@/hooks/useCatalog";
import type { OrderStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { TableContainer } from "@/components/ui/TableContainer";

function formatCop(cents: number): string {
  return (cents / 100).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

const STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

export function CatalogOrdersList({ botId }: { botId: string }) {
  const t = useT();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const { data, isLoading } = useCatalogOrders(botId, statusFilter || undefined);
  const updateOrder = useUpdateCatalogOrder(botId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-gray-100" />;
  }

  const orders = data?.orders ?? [];
  const selected = orders.find((o) => o.orderId === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-600">{t("catalog.filterStatus")}</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          <option value="">{t("catalog.allStatuses")}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`catalog.orderStatus.${status}`)}
            </option>
          ))}
        </select>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">{t("catalog.noOrders")}</p>
      ) : (
        <TableContainer className="rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-3">{t("catalog.colDate")}</th>
                <th className="px-4 py-3">{t("catalog.colContact")}</th>
                <th className="px-4 py-3">{t("catalog.colItems")}</th>
                <th className="px-4 py-3">{t("catalog.colTotal")}</th>
                <th className="px-4 py-3">{t("catalog.colStatus")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const orderItems = order.items ?? [];
                return (
                <tr key={order.orderId}>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{order.contactPhone}</div>
                    {order.contactName ? (
                      <div className="text-gray-500">{order.contactName}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{orderItems.length}</td>
                  <td className="px-4 py-3">{formatCop(order.subtotalInCents ?? 0)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={order.status === "cancelled" ? "danger" : "default"}>
                      {t(`catalog.orderStatus.${order.status}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(order.orderId)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      {t("common.edit")}
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </TableContainer>
      )}

      {selected ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">{t("catalog.orderDetail")}</h3>
          <ul className="space-y-1 text-sm text-gray-700">
            {(selected.items ?? []).map((item) => (
              <li key={`${selected.orderId}-${item.retailerId}`}>
                {item.quantity}x {item.name} — {formatCop(item.unitPriceInCents * item.quantity)}
              </li>
            ))}
          </ul>
          {selected.customerNote ? (
            <p className="text-sm text-gray-600">{selected.customerNote}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selected.status}
              onChange={(e) =>
                void updateOrder.mutateAsync({
                  orderId: selected.orderId,
                  status: e.target.value as OrderStatus,
                })
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`catalog.orderStatus.${status}`)}
                </option>
              ))}
            </select>
            {selected.paymentId ? (
              <span className="text-sm text-gray-500">
                {t("catalog.paymentLinked")}: {selected.paymentId.slice(0, 8)}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
