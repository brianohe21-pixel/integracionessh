"use client";

import { useState } from "react";
import { Copy, Link2, Plus, QrCode, Trash2 } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  useCreateShortLink,
  useDeleteShortLink,
  useShortLinks,
  useUpdateShortLink,
} from "@/hooks/useShortLinks";
import { useDialog } from "@/components/ui/DialogProvider";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonTable } from "@/components/ui/Skeleton";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableRow,
} from "@/components/ui/DataTable";
import { ShortLinkForm } from "@/components/short-links/ShortLinkForm";
import { ShortLinkQr } from "@/components/short-links/ShortLinkQr";

export default function ShortLinksPage() {
  const t = useT();
  const { confirm } = useDialog();
  const { data, isLoading } = useShortLinks();
  const create = useCreateShortLink();
  const remove = useDeleteShortLink();
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedQr, setExpandedQr] = useState<string | null>(null);
  const links = data?.items ?? [];

  async function copyUrl(linkId: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    window.setTimeout(() => setCopiedId(null), 1500);
  }

  async function handleDelete(linkId: string, name: string) {
    const ok = await confirm({
      title: t("shortLinks.deleteTitle"),
      description: t("shortLinks.deleteConfirm", { name }),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    await remove.mutateAsync(linkId);
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("shortLinks.title")}
        subtitle={t("shortLinks.subtitle")}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t("shortLinks.new")}
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonTable rows={4} cols={5} />
      ) : !links.length ? (
        <EmptyState
          icon={<Link2 className="h-6 w-6" />}
          title={t("shortLinks.empty")}
          description={t("shortLinks.emptyHint")}
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t("shortLinks.new")}
            </Button>
          }
        />
      ) : (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableCell header>{t("shortLinks.colName")}</DataTableCell>
              <DataTableCell header>{t("shortLinks.colShortUrl")}</DataTableCell>
              <DataTableCell header>{t("shortLinks.colClicks")}</DataTableCell>
              <DataTableCell header>{t("shortLinks.colStatus")}</DataTableCell>
              <DataTableCell header className="text-right">
                {t("shortLinks.colActions")}
              </DataTableCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {links.map((link) => {
              const shortUrl =
                link.shortUrl ??
                `${(process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")}/l/${link.slug}`;
              return (
                <DataTableRow key={link.linkId}>
                  <DataTableCell>
                    <div>
                      <p className="font-medium text-primary">{link.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">{link.destinationUrl}</p>
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      <code className="max-w-[200px] truncate text-xs">{shortUrl}</code>
                      <button
                        type="button"
                        onClick={() => void copyUrl(link.linkId, shortUrl)}
                        className="rounded border border-default p-1 text-secondary hover:text-primary"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {copiedId === link.linkId ? (
                      <p className="mt-1 text-xs text-success">{t("shortLinks.copied")}</p>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell>{link.clickCount}</DataTableCell>
                  <DataTableCell>
                    <Badge variant={link.enabled ? "success" : "default"}>
                      {link.enabled ? t("shortLinks.active") : t("shortLinks.inactive")}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <ToggleLinkButton linkId={link.linkId} enabled={link.enabled} />
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedQr((current) => (current === link.linkId ? null : link.linkId))
                        }
                        className="rounded border border-default p-1.5 text-secondary hover:text-primary"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(link.linkId, link.name)}
                        className="rounded border border-default p-1.5 text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {expandedQr === link.linkId ? (
                      <div className="mt-3 flex justify-end">
                        <ShortLinkQr url={shortUrl} label={link.name} />
                      </div>
                    ) : null}
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">{t("shortLinks.new")}</h2>
            <p className="mt-1 text-sm text-secondary">{t("shortLinks.createHint")}</p>
            <div className="mt-4">
              <ShortLinkForm
                submitLabel={t("shortLinks.create")}
                pending={create.isPending}
                onCancel={() => setShowCreate(false)}
                onSubmit={async (values) => {
                  await create.mutateAsync(values);
                  setShowCreate(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </DashboardPage>
  );
}

function ToggleLinkButton({ linkId, enabled }: { linkId: string; enabled: boolean }) {
  const t = useT();
  const update = useUpdateShortLink(linkId);

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={update.isPending}
      onClick={() => void update.mutateAsync({ enabled: !enabled })}
    >
      {enabled ? t("shortLinks.disable") : t("shortLinks.enable")}
    </Button>
  );
}
