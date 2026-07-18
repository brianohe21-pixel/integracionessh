"use client";

import { useState } from "react";
import { useT } from "@/i18n/context";
import {
  useCatalogProducts,
  useCreateCatalogProduct,
  useDeleteCatalogProduct,
  useUploadCatalogProductImage,
} from "@/hooks/useCatalog";
import type { ProductAvailability } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { TableContainer } from "@/components/ui/TableContainer";

function formatCop(cents: number): string {
  return (cents / 100).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

export function CatalogProductsList({ botId }: { botId: string }) {
  const t = useT();
  const { data, isLoading } = useCatalogProducts(botId);
  const createProduct = useCreateCatalogProduct(botId);
  const deleteProduct = useDeleteCatalogProduct(botId);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    retailerId: "",
    name: "",
    description: "",
    priceInCents: 10000,
    availability: "in_stock" as ProductAvailability,
  });
  const [uploadProductId, setUploadProductId] = useState("");
  const uploadImage = useUploadCatalogProductImage(botId, uploadProductId);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createProduct.mutateAsync(form);
      setForm({
        retailerId: "",
        name: "",
        description: "",
        priceInCents: 10000,
        availability: "in_stock",
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleImageUpload(productId: string, file: File | null) {
    if (!file) return;
    setUploadProductId(productId);
    setError("");
    try {
      await uploadImage.mutateAsync(file);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface-muted" />;
  }

  const products = data?.products ?? [];

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void handleCreate(e)} className="rounded-xl border border-default bg-surface-elevated p-4 space-y-3">
        <h3 className="text-sm font-semibold text-primary">{t("catalog.createProduct")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            value={form.retailerId}
            onChange={(e) => setForm((f) => ({ ...f, retailerId: e.target.value }))}
            placeholder={t("catalog.retailerId")}
            className="px-3 py-2 border border-default rounded-lg text-sm"
          />
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t("catalog.productName")}
            className="px-3 py-2 border border-default rounded-lg text-sm"
          />
          <input
            type="number"
            min={100}
            value={form.priceInCents}
            onChange={(e) => setForm((f) => ({ ...f, priceInCents: Number(e.target.value) }))}
            placeholder={t("catalog.priceInCents")}
            className="px-3 py-2 border border-default rounded-lg text-sm"
          />
          <select
            value={form.availability}
            onChange={(e) =>
              setForm((f) => ({ ...f, availability: e.target.value as ProductAvailability }))
            }
            className="px-3 py-2 border border-default rounded-lg text-sm bg-surface-elevated"
          >
            <option value="in_stock">{t("catalog.availability.in_stock")}</option>
            <option value="out_of_stock">{t("catalog.availability.out_of_stock")}</option>
          </select>
        </div>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder={t("catalog.productDescription")}
          rows={2}
          className="w-full px-3 py-2 border border-default rounded-lg text-sm"
        />
        <button
          type="submit"
          disabled={createProduct.isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          {t("catalog.addProduct")}
        </button>
      </form>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {products.length === 0 ? (
        <p className="text-sm text-secondary">{t("catalog.noProducts")}</p>
      ) : (
        <TableContainer className="rounded-xl border border-default">
          <table className="min-w-full text-sm">
            <thead className="bg-surface text-left text-secondary">
              <tr>
                <th className="px-4 py-3">{t("catalog.colName")}</th>
                <th className="px-4 py-3">{t("catalog.retailerId")}</th>
                <th className="px-4 py-3">{t("catalog.colPrice")}</th>
                <th className="px-4 py-3">{t("catalog.colStock")}</th>
                <th className="px-4 py-3">{t("catalog.colSync")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.productId}>
                  <td className="px-4 py-3 font-medium text-primary">{product.name}</td>
                  <td className="px-4 py-3 text-secondary">{product.retailerId}</td>
                  <td className="px-4 py-3">{formatCop(product.priceInCents)}</td>
                  <td className="px-4 py-3">
                    {t(`catalog.availability.${product.availability}`)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={product.syncStatus === "synced" ? "success" : "warning"}>
                      {product.syncStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer text-xs text-accent hover:underline">
                        {t("catalog.uploadImage")}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            void handleImageUpload(product.productId, e.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void deleteProduct.mutateAsync(product.productId)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}
    </div>
  );
}
