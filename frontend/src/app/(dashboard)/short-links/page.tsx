"use client";

import { useState } from "react";
import { Copy, Link2, Plus } from "lucide-react";
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
import { Modal } from "@/components/ui/Modal";
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
import { ShortLinkActionsMenu } from "@/components/short-links/ShortLinkActionsMenu";
import { ShortLinkForm } from "@/components/short-links/ShortLinkForm";
import { ShortLinkQr } from "@/components/short-links/ShortLinkQr";
import type { ShortLink } from "@/types";

export default function ShortLinksPage() {
  const t = useT();
  const { confirm } = useDialog();
  const { data, isLoading } = useShortLinks();
  const create = useCreateShortLink();
  const remove = useDeleteShortLink();
  const [showCreate, setShowCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<{ name: string; url: string } | null>(null);
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
                    <div className="flex items-center justify-end">
                      <ShortLinkRowActions
                        link={link}
                        deletePending={remove.isPending}
                        onCopy={() => void copyUrl(link.linkId, shortUrl)}
                        onShowQr={() => setQrModal({ name: link.name, url: shortUrl })}
                        onDelete={() => void handleDelete(link.linkId, link.name)}
                      />
                    </div>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}

      {qrModal ? (
        <Modal>
          <div className="w-full max-w-sm rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-primary">{t("shortLinks.qrTitle")}</h2>
            <p className="mt-1 text-sm text-secondary">{qrModal.name}</p>
            <p className="mt-2 break-all text-xs text-muted">{qrModal.url}</p>
            <div className="mt-5 flex justify-center">
              <ShortLinkQr url={qrModal.url} label={qrModal.name} />
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setQrModal(null)}>
                {t("common.close")}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center">
            <div className="w-full rounded-xl border border-default bg-surface-elevated p-6 shadow-xl">
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
        </div>
      ) : null}
    </DashboardPage>
  );
}

type ShortLinkRowActionsProps = {
  link: ShortLink;
  deletePending: boolean;
  onCopy: () => void;
  onShowQr: () => void;
  onDelete: () => void;
};

function ShortLinkRowActions({
  link,
  deletePending,
  onCopy,
  onShowQr,
  onDelete,
}: ShortLinkRowActionsProps) {
  const update = useUpdateShortLink(link.linkId);

  return (
    <ShortLinkActionsMenu
      enabled={link.enabled}
      busy={deletePending || update.isPending}
      onCopy={onCopy}
      onShowQr={onShowQr}
      onToggleEnabled={() => void update.mutateAsync({ enabled: !link.enabled })}
      onOpenDestination={() => window.open(link.destinationUrl, "_blank", "noopener,noreferrer")}
      onDelete={onDelete}
    />
  );
}
