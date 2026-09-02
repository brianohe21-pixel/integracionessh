"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Upload,
  Download,
  BookUser,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  UserX,
  Ban,
  FilterX,
} from "lucide-react";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useImportContacts,
  useDeleteContact,
  downloadContactsExport,
} from "@/hooks/useContacts";
import { ContactDetailPanel } from "@/components/contacts/ContactDetailPanel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchInput } from "@/components/ui/SearchInput";
import { Input, Select } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableRow } from "@/components/ui/DataTable";
import { WhatsAppRiskBadge } from "@/components/whatsapp/WhatsAppRiskBadge";
import { useT } from "@/i18n/context";
import type { Contact, MarketingConsent } from "@/types";
import { decodeCsvBytes } from "@/lib/csv";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { useWhatsAppRisk, resolveWhatsAppRisk } from "@/hooks/useWhatsAppRisk";

function consentVariant(c: MarketingConsent): "success" | "warning" | "danger" | "default" {
  if (c === "opt_in") return "success";
  if (c === "opt_out") return "danger";
  return "default";
}

function csatVariant(score: number): "success" | "warning" | "danger" {
  if (score >= 4) return "success";
  if (score >= 3) return "warning";
  return "danger";
}

function contactInitials(name?: string, phone?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return phone?.slice(-2) ?? "?";
}

export default function ContactsPage() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [consentFilter, setConsentFilter] = useState<"" | MarketingConsent>("");
  const [suppressedFilter, setSuppressedFilter] = useState<"" | "true" | "false">("");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [showCompliance, setShowCompliance] = useState(true);
  const [error, setError] = useState("");

  const hasFilters = consentFilter || suppressedFilter || tagFilter || q;

  const { data, isLoading } = useContacts({
    tag: tagFilter || undefined,
    consent: consentFilter || undefined,
    suppressed: suppressedFilter === "" ? undefined : suppressedFilter === "true",
    q: q || undefined,
  });
  const { data: whatsappRisk } = useWhatsAppRisk();

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const importContacts = useImportContacts();
  const deleteContact = useDeleteContact();

  const contacts = useMemo(() => data?.items ?? [], [data?.items]);

  const activeContact = selectedContact
    ? contacts.find((c) => c.phoneNumber === selectedContact.phoneNumber) ?? selectedContact
    : null;

  const metrics = useMemo(() => {
    const optIn = contacts.filter((c) => c.marketingConsent === "opt_in").length;
    const optOut = contacts.filter((c) => c.marketingConsent === "opt_out").length;
    const suppressed = contacts.filter((c) => c.suppressed).length;
    return { total: contacts.length, optIn, optOut, suppressed };
  }, [contacts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await createContact.mutateAsync({
        phoneNumber: phone,
        displayName: name || undefined,
        marketingConsent: "opt_in",
      });
      setPhone("");
      setName("");
      setShowCreate(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = decodeCsvBytes(bytes);
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines.slice(1).map((line) => {
        const [phoneCol, nameCol, consentCol] = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        return {
          phone: phoneCol ?? "",
          name: nameCol || undefined,
          marketingConsent: (consentCol as MarketingConsent) || undefined,
        };
      }).filter((r) => r.phone.length >= 10);
      await importContacts.mutateAsync(rows);
    } catch (err) {
      setError((err as Error).message);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function bulkConsent(phones: string[], consent: MarketingConsent) {
    await Promise.all(
      phones.map((p) => updateContact.mutateAsync({ phone: p, marketingConsent: consent }))
    );
  }

  function clearFilters() {
    setQ("");
    setConsentFilter("");
    setSuppressedFilter("");
    setTagFilter("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setError("");
    try {
      await deleteContact.mutateAsync(deleteTarget.phoneNumber);
      if (selectedContact?.phoneNumber === deleteTarget.phoneNumber) {
        setSelectedContact(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <DashboardPage>
      <PageHeader
        title={t("contacts.title")}
        subtitle={t("contacts.subtitle")}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {t("contacts.import")}
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => downloadContactsExport("opt_out")}
            >
              <Download className="h-4 w-4" />
              {t("contacts.export")}
            </Button>
            <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t("contacts.new")}
            </Button>
          </>
        }
      />

      {showCompliance && (
        <Alert
          variant="info"
          className="mb-6"
          onDismiss={() => setShowCompliance(false)}
        >
          {t("contacts.complianceBanner")}{" "}
          <Link href="/legal/privacy" className="font-medium underline">
            {t("contacts.privacyLink")}
          </Link>
        </Alert>
      )}

      {!isLoading && contacts.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label={t("contacts.metricsTotal")}
            value={String(metrics.total)}
            icon={<BookUser className="h-5 w-5 text-accent" />}
          />
          <StatCard
            label={t("contacts.metricsOptIn")}
            value={String(metrics.optIn)}
            icon={<UserCheck className="h-5 w-5 text-success" />}
          />
          <StatCard
            label={t("contacts.metricsOptOut")}
            value={String(metrics.optOut)}
            icon={<UserX className="h-5 w-5 text-danger" />}
          />
          <StatCard
            label={t("contacts.metricsSuppressed")}
            value={String(metrics.suppressed)}
            icon={<Ban className="h-5 w-5 text-warning" />}
          />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("contacts.searchPlaceholder")}
          onClear={() => setQ("")}
          className="sm:min-w-[240px] sm:flex-1"
        />
        <Select
          value={consentFilter}
          onChange={(e) => setConsentFilter(e.target.value as "" | MarketingConsent)}
          className="sm:w-auto sm:min-w-[160px]"
        >
          <option value="">{t("contacts.filterAllConsent")}</option>
          <option value="opt_in">{t("contacts.consentOptIn")}</option>
          <option value="opt_out">{t("contacts.consentOptOut")}</option>
          <option value="unknown">{t("contacts.consentUnknown")}</option>
        </Select>
        <Select
          value={suppressedFilter}
          onChange={(e) => setSuppressedFilter(e.target.value as "" | "true" | "false")}
          className="sm:w-auto sm:min-w-[140px]"
        >
          <option value="">{t("contacts.filterAllSuppressed")}</option>
          <option value="false">{t("contacts.notSuppressed")}</option>
          <option value="true">{t("contacts.suppressed")}</option>
        </Select>
        <Select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="sm:w-auto sm:min-w-[160px]"
        >
          <option value="">{t("contacts.colTags")}</option>
          <option value="lead">{t("contacts.filterTagLead")}</option>
          <option value="converted">{t("contacts.filterTagConverted")}</option>
        </Select>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <FilterX className="h-4 w-4" />
            {t("common.clearFilters")}
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="danger" className="mb-4" onDismiss={() => setError("")}>
          {error}
        </Alert>
      )}

      {isLoading && <SkeletonTable rows={6} cols={5} className="mb-4" />}

      {!isLoading && contacts.length === 0 && (
        <EmptyState
          icon={<BookUser className="w-6 h-6" />}
          title={hasFilters ? t("contacts.noResultsTitle") : t("contacts.emptyTitle")}
          description={hasFilters ? t("contacts.noResultsDescription") : t("contacts.emptyDescription")}
          action={
            hasFilters ? (
              <Button type="button" variant="secondary" size="sm" onClick={clearFilters}>
                {t("common.clearFilters")}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                {t("contacts.new")}
              </Button>
            )
          }
        />
      )}

      {!isLoading && contacts.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-secondary">
              {t("contacts.shownCount", { count: contacts.length })}
            </p>
            {contacts.length > 1 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => bulkConsent(contacts.map((c) => c.phoneNumber), "opt_in")}
              >
                <ShieldCheck className="h-4 w-4" />
                {t("contacts.bulkOptIn")}
              </Button>
            )}
          </div>

          <DataTable minWidth="720px">
            <DataTableHead>
              <DataTableRow className="border-b border-default bg-surface-muted/60 text-xs uppercase tracking-wide text-secondary">
                <DataTableCell header>{t("contacts.colContact")}</DataTableCell>
                <DataTableCell header>{t("contacts.colConsent")}</DataTableCell>
                <DataTableCell header>{t("contacts.colCsat")}</DataTableCell>
                <DataTableCell header>{t("contacts.colTags")}</DataTableCell>
                <DataTableCell header>{t("contacts.colWhatsAppRisk")}</DataTableCell>
                <DataTableCell header className="w-10">
                  <span className="sr-only">{t("contacts.colActions")}</span>
                </DataTableCell>
              </DataTableRow>
            </DataTableHead>
            <DataTableBody className="divide-y divide-subtle">
              {contacts.map((c: Contact) => {
                const initials = contactInitials(c.displayName, c.phoneNumber);
                return (
                  <DataTableRow
                    key={c.phoneNumber}
                    className="group cursor-pointer transition-colors hover:bg-surface-muted/50"
                    onClick={() => setSelectedContact(c)}
                  >
                    <DataTableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-xs font-semibold text-accent">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-primary">
                            {c.displayName ?? t("contacts.unnamed")}
                          </p>
                          <p className="truncate font-mono text-xs text-secondary">{c.phoneNumber}</p>
                          {c.email && (
                            <p className="truncate text-xs text-muted">{c.email}</p>
                          )}
                        </div>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={consentVariant(c.marketingConsent)}>
                          {t(`contacts.consent_${c.marketingConsent}`)}
                        </Badge>
                        {c.suppressed && (
                          <Badge variant="danger">{t("contacts.suppressed")}</Badge>
                        )}
                        {c.leadId && (
                          <Badge variant="info">
                            {c.tags.includes("converted") ? t("contacts.tagConverted") : t("contacts.tagLead")}
                          </Badge>
                        )}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      {c.csatAverage !== undefined && c.csatRatingCount !== undefined ? (
                        <Badge variant={csatVariant(c.csatAverage)}>
                          {c.csatAverage}/5 ({c.csatRatingCount})
                        </Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      {c.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="default">{tag}</Badge>
                          ))}
                          {c.tags.length > 3 && (
                            <Badge variant="default">+{c.tags.length - 3}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </DataTableCell>
                    <DataTableCell>
                      <WhatsAppRiskBadge
                        risk={resolveWhatsAppRisk(whatsappRisk, c.lastBotId)}
                        compact
                      />
                    </DataTableCell>
                    <DataTableCell className="text-right">
                      <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </>
      )}

      {showCreate && (
        <Modal>
          <div className="w-full max-w-md rounded-2xl border border-default bg-surface-elevated shadow-xl">
            <div className="border-b border-default px-6 py-4">
              <h2 className="text-lg font-semibold text-primary">{t("contacts.createTitle")}</h2>
              <p className="mt-1 text-sm text-secondary">{t("contacts.createDescription")}</p>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary">
                  {t("common.phone")}
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("contacts.phonePlaceholder")}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary">
                  {t("contacts.colName")}
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("contacts.namePlaceholder")}
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-default pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createContact.isPending}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {activeContact && (
        <ContactDetailPanel
          key={activeContact.phoneNumber + activeContact.updatedAt}
          contact={activeContact}
          whatsappRisk={whatsappRisk}
          onClose={() => setSelectedContact(null)}
          onDelete={() => setDeleteTarget(activeContact)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("contacts.deleteConfirmTitle")}
        description={t("contacts.deleteConfirmDescription", {
          phone: deleteTarget?.phoneNumber ?? "",
        })}
        confirmLabel={t("common.delete")}
        tone="danger"
        loading={deleteContact.isPending}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardPage>
  );
}
