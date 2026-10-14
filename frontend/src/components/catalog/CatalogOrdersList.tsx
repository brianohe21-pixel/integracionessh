"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useT } from "@/i18n/context";
import { useCatalogOrders, useUpdateCatalogOrder } from "@/hooks/useCatalog";
import type { OrderStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SideDrawer } from "@/components/ui/SideDrawer";
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

function orderStatusVariant(
  status: OrderStatus
): "success" | "warning" | "danger" | "info" | "default" | "accent" {
  if (status === "delivered" || status === "confirmed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "shipped" || status === "preparing") return "info";
  if (status === "pending") return "warning";
  return "default";
}

export function CatalogOrdersList({ botId }: { botId: string }) {
  const t = useT();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const { data, isLoading } = useCatalogOrders(botId, statusFilter || undefined);
  const updateOrder = useUpdateCatalogOrder(botId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />;
  }

  const orders = data?.orders ?? [];
  const selected = orders.find((o) => o.orderId === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-secondary">{t("catalog.filterStatus")}</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
          className="rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
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
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title={t("catalog.noOrdersTitle")}
          description={t("catalog.noOrders")}
        />
      ) : (
        <TableContainer className="rounded-xl border border-default">
          <table className="min-w-full text-sm">
            <thead className="bg-surface text-left text-secondary">
              <tr>
                <th className="px-4 py-3">{t("catalog.colDate")}</th>
                <th className="px-4 py-3">{t("catalog.colContact")}</th>
                <th className="px-4 py-3">{t("catalog.colItems")}</th>
                <th className="px-4 py-3">{t("catalog.colTotal")}</th>
                <th className="px-4 py-3">{t("catalog.colStatus")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {orders.map((order) => {
                const orderItems = order.items ?? [];
                return (
                  <tr
                    key={order.orderId}
                    className="cursor-pointer transition-colors hover:bg-surface-muted/40"
                    onClick={() => setSelectedId(order.orderId)}
                  >
                    <td className="px-4 py-3 text-secondary">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">{order.contactPhone}</div>
                      {order.contactName ? (
                        <div className="text-xs text-secondary">{order.contactName}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{orderItems.length}</td>
                    <td className="px-4 py-3 font-medium text-primary">
                      {formatCop(order.subtotalInCents ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={orderStatusVariant(order.status)} dot>
                        {t(`catalog.orderStatus.${order.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(order.orderId);
                        }}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        {t("common.edit")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableContainer>
      )}

      {selected ? (
        <SideDrawer
          title={t("catalog.orderDetail")}
          subtitle={selected.contactPhone}
          onClose={() => setSelectedId(null)}
          footer={
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setSelectedId(null)}>
                {t("catalog.closeDetail")}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={orderStatusVariant(selected.status)} dot>
                {t(`catalog.orderStatus.${selected.status}`)}
              </Badge>
              <span className="text-sm text-secondary">
                {new Date(selected.createdAt).toLocaleString()}
              </span>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-primary">{t("catalog.orderItems")}</p>
              <ul className="divide-y divide-default rounded-xl border border-default">
                {(selected.items ?? []).map((item) => (
                  <li
                    key={`${selected.orderId}-${item.retailerId}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="text-primary">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="font-medium text-primary">
                      {formatCop(item.unitPriceInCents * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-right text-sm font-semibold text-primary">
                {t("catalog.colTotal")}: {formatCop(selected.subtotalInCents ?? 0)}
              </p>
            </div>

            {selected.customerNote ? (
              <div>
                <p className="mb-1 text-sm font-medium text-primary">{t("catalog.customerNote")}</p>
                <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-secondary">
                  {selected.customerNote}
                </p>
              </div>
            ) : null}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary">
                {t("catalog.updateStatus")}
              </label>
              <select
                value={selected.status}
                onChange={(e) =>
                  void updateOrder.mutateAsync({
                    orderId: selected.orderId,
                    status: e.target.value as OrderStatus,
                  })
                }
                className="w-full rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`catalog.orderStatus.${status}`)}
                  </option>
                ))}
              </select>
            </div>

            {selected.paymentId ? (
              <p className="text-sm text-secondary">
                {t("catalog.paymentLinked")}: {selected.paymentId.slice(0, 8)}…
              </p>
            ) : null}
          </div>
        </SideDrawer>
      ) : null}
    </div>
  );
}
