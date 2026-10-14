"use client";

import { useState } from "react";
import { ImagePlus, Package, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useCatalogProducts,
  useCreateCatalogProduct,
  useDeleteCatalogProduct,
  useUploadCatalogProductImage,
} from "@/hooks/useCatalog";
import type { ProductAvailability, ProductSyncStatus } from "@/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableContainer } from "@/components/ui/TableContainer";

function formatCop(cents: number): string {
  return (cents / 100).toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

function productSyncVariant(
  status: ProductSyncStatus
): "success" | "warning" | "danger" | "default" {
  if (status === "synced") return "success";
  if (status === "error") return "danger";
  return "warning";
}

export function CatalogProductsList({ botId }: { botId: string }) {
  const t = useT();
  const { data, isLoading } = useCatalogProducts(botId);
  const createProduct = useCreateCatalogProduct(botId);
  const deleteProduct = useDeleteCatalogProduct(botId);
  const [error, setError] = useState("");
  const [pricePesos, setPricePesos] = useState("100");
  const [form, setForm] = useState({
    retailerId: "",
    name: "",
    description: "",
    availability: "in_stock" as ProductAvailability,
  });
  const [uploadProductId, setUploadProductId] = useState("");
  const uploadImage = useUploadCatalogProductImage(botId, uploadProductId);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const pesos = Number(pricePesos);
    if (!Number.isFinite(pesos) || pesos < 1) {
      setError(t("catalog.priceHint"));
      return;
    }
    try {
      await createProduct.mutateAsync({
        ...form,
        priceInCents: Math.round(pesos * 100),
      });
      setForm({
        retailerId: "",
        name: "",
        description: "",
        availability: "in_stock",
      });
      setPricePesos("100");
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
      <form
        onSubmit={(e) => void handleCreate(e)}
        className="space-y-4 rounded-xl border border-default bg-surface-elevated p-5"
      >
        <h3 className="text-sm font-semibold text-primary">{t("catalog.createProduct")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              {t("catalog.retailerId")}
            </label>
            <input
              required
              value={form.retailerId}
              onChange={(e) => setForm((f) => ({ ...f, retailerId: e.target.value }))}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              {t("catalog.productName")}
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              {t("catalog.price")}
            </label>
            <input
              type="number"
              min={1}
              step="1"
              required
              value={pricePesos}
              onChange={(e) => setPricePesos(e.target.value)}
              className="w-full rounded-lg border border-default px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-secondary">{t("catalog.priceHint")}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">
              {t("catalog.colStock")}
            </label>
            <select
              value={form.availability}
              onChange={(e) =>
                setForm((f) => ({ ...f, availability: e.target.value as ProductAvailability }))
              }
              className="w-full rounded-lg border border-default bg-surface-elevated px-3 py-2 text-sm"
            >
              <option value="in_stock">{t("catalog.availability.in_stock")}</option>
              <option value="out_of_stock">{t("catalog.availability.out_of_stock")}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-secondary">
            {t("catalog.productDescription")}
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-default px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" disabled={createProduct.isPending}>
          {t("catalog.addProduct")}
        </Button>
      </form>

      {error ? (
        <Alert variant="danger" onDismiss={() => setError("")}>
          {error}
        </Alert>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title={t("catalog.noProductsTitle")}
          description={t("catalog.noProducts")}
        />
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
            <tbody className="divide-y divide-default">
              {products.map((product) => (
                <tr key={product.productId} className="align-middle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover ring-1 ring-default"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-muted text-secondary">
                          <Package className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-primary">{product.name}</p>
                        {product.description ? (
                          <p className="truncate text-xs text-secondary">{product.description}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary">{product.retailerId}</td>
                  <td className="px-4 py-3 font-medium text-primary">
                    {formatCop(product.priceInCents)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={product.availability === "in_stock" ? "success" : "warning"}
                      dot
                    >
                      {t(`catalog.availability.${product.availability}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={productSyncVariant(product.syncStatus)} dot>
                      {t(`catalog.productSyncStatus.${product.syncStatus}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-field-border px-2.5 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-surface-muted hover:text-primary">
                        <ImagePlus className="h-3.5 w-3.5" />
                        {t("catalog.uploadImage")}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            void handleImageUpload(
                              product.productId,
                              e.target.files?.[0] ?? null
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void deleteProduct.mutateAsync(product.productId)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
