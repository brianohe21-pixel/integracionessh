"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Plus, Upload, Download, BookUser } from "lucide-react";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useImportContacts,
  useDeleteContact,
  downloadContactsExport,
} from "@/hooks/useContacts";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/i18n/context";
import type { Contact, MarketingConsent } from "@/types";
import { decodeCsvBytes } from "@/lib/csv";
import { DashboardPage } from "@/components/layout/DashboardPage";
import { PageHeader } from "@/components/layout/PageHeader";
import { TableContainer } from "@/components/ui/TableContainer";

function consentVariant(c: MarketingConsent): "success" | "warning" | "danger" | "default" {
  if (c === "opt_in") return "success";
  if (c === "opt_out") return "danger";
  return "default";
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
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");

  const [error, setError] = useState("");

  const { data, isLoading } = useContacts({
    tag: tagFilter || undefined,
    consent: consentFilter || undefined,
    suppressed: suppressedFilter === "" ? undefined : suppressedFilter === "true",
    q: q || undefined,
  });

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const importContacts = useImportContacts();
  const deleteContact = useDeleteContact();

  const contacts = data?.items ?? [];

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
  }

  async function bulkConsent(phones: string[], consent: MarketingConsent) {
    await Promise.all(
      phones.map((p) => updateContact.mutateAsync({ phone: p, marketingConsent: consent }))
    );
  }

  return (
    <DashboardPage maxWidth="6xl">
      <PageHeader
        title={t("contacts.title")}
        subtitle={t("contacts.subtitle")}
        actions={
          <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            {t("contacts.import")}
          </button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button
            type="button"
            onClick={() => downloadContactsExport("opt_out")}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            {t("contacts.export")}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            {t("contacts.new")}
          </button>
          </>
        }
      />

      <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-900">
        {t("contacts.complianceBanner")}{" "}
        <Link href="/legal/privacy" className="underline font-medium">
          {t("contacts.privacyLink")}
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("contacts.searchPlaceholder")}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[200px]"
        />
        <select
          value={consentFilter}
          onChange={(e) => setConsentFilter(e.target.value as "" | MarketingConsent)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">{t("contacts.filterAllConsent")}</option>
          <option value="opt_in">{t("contacts.consentOptIn")}</option>
          <option value="opt_out">{t("contacts.consentOptOut")}</option>
          <option value="unknown">{t("contacts.consentUnknown")}</option>
        </select>
        <select
          value={suppressedFilter}
          onChange={(e) => setSuppressedFilter(e.target.value as "" | "true" | "false")}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">{t("contacts.filterAllSuppressed")}</option>
          <option value="false">{t("contacts.notSuppressed")}</option>
          <option value="true">{t("contacts.suppressed")}</option>
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="">{t("contacts.colTags")}</option>
          <option value="lead">{t("contacts.filterTagLead")}</option>
          <option value="converted">{t("contacts.filterTagConverted")}</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white border border-gray-200 rounded-xl space-y-3">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("contacts.phonePlaceholder")}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("contacts.namePlaceholder")}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg">
              {t("common.save")}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-sm text-gray-500">{t("common.loading")}</p>}

      {!isLoading && contacts.length === 0 && (
        <EmptyState
          icon={<BookUser className="w-6 h-6" />}
          title={t("contacts.emptyTitle")}
          description={t("contacts.emptyDescription")}
        />
      )}

      {contacts.length > 0 && (
        <TableContainer className="rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <th className="px-4 py-3">{t("common.phone")}</th>
                <th className="px-4 py-3">{t("contacts.colName")}</th>
                <th className="px-4 py-3">{t("contacts.colEmail")}</th>
                <th className="px-4 py-3">{t("contacts.colConsent")}</th>
                <th className="px-4 py-3">{t("contacts.colTags")}</th>
                <th className="px-4 py-3 text-right">{t("contacts.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((c: Contact) => (
                <tr key={c.phoneNumber} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-gray-900">{c.phoneNumber}</td>
                  <td className="px-4 py-3">{c.displayName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={consentVariant(c.marketingConsent)}>
                      {t(`contacts.consent_${c.marketingConsent}`)}
                    </Badge>
                    {c.suppressed && (
                      <Badge variant="danger" className="ml-1">
                        {t("contacts.suppressed")}
                      </Badge>
                    )}
                    {c.leadId && (
                      <Badge variant="info" className="ml-1">
                        {c.tags.includes("converted") ? t("contacts.tagConverted") : t("contacts.tagLead")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {editingPhone === c.phoneNumber ? (
                      <div className="flex gap-1">
                        <input
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          placeholder={t("contacts.tagsPlaceholder")}
                          className="px-2 py-1 border border-gray-300 rounded text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await updateContact.mutateAsync({
                              phone: c.phoneNumber,
                              tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
                            });
                            setEditingPhone(null);
                          }}
                          className="text-xs text-indigo-600"
                        >
                          {t("common.save")}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPhone(c.phoneNumber);
                          setEditTags(c.tags.join(", "));
                        }}
                        className="text-left hover:text-indigo-600"
                      >
                        {c.tags.join(", ") || "—"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {c.marketingConsent !== "opt_in" && (
                      <button
                        type="button"
                        onClick={() => updateContact.mutate({ phone: c.phoneNumber, marketingConsent: "opt_in" })}
                        className="text-xs text-indigo-600 hover:underline"
                      >
                        {t("contacts.markOptIn")}
                      </button>
                    )}
                    {c.marketingConsent !== "opt_out" && (
                      <button
                        type="button"
                        onClick={() => updateContact.mutate({ phone: c.phoneNumber, marketingConsent: "opt_out", suppressed: true })}
                        className="text-xs text-red-600 hover:underline"
                      >
                        {t("contacts.markOptOut")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteContact.mutate(c.phoneNumber)}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      {t("common.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}

      {contacts.length > 1 && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => bulkConsent(contacts.map((c) => c.phoneNumber), "opt_in")}
            className="text-xs px-3 py-1.5 bg-green-100 text-green-800 rounded-lg"
          >
            {t("contacts.bulkOptIn")}
          </button>
        </div>
      )}
    </DashboardPage>
  );
}
