"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Loader2, Square, Users } from "lucide-react";
import { useT } from "@/i18n/context";
import {
  CAMPAIGN_MAX_RECIPIENTS,
  fetchAllMatchingContactPhones,
  useContacts,
  type ContactListFilters,
} from "@/hooks/useContacts";
import type { MarketingConsent } from "@/types";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input, Select } from "@/components/ui/Input";
import { SearchInput } from "@/components/ui/SearchInput";
import { TableContainer } from "@/components/ui/TableContainer";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

interface CampaignContactPickerProps {
  selectedPhones: string[];
  onChange: (phones: string[]) => void;
  requireOptIn?: boolean;
}

export function CampaignContactPicker({
  selectedPhones,
  onChange,
  requireOptIn = false,
}: CampaignContactPickerProps) {
  const t = useT();
  const [q, setQ] = useState("");
  const [consentFilter, setConsentFilter] = useState<"" | MarketingConsent>(
    requireOptIn ? "opt_in" : ""
  );
  const [tagFilter, setTagFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectingAll, setSelectingAll] = useState(false);
  const [error, setError] = useState("");
  const [truncatedNotice, setTruncatedNotice] = useState(false);

  useEffect(() => {
    if (requireOptIn) setConsentFilter("opt_in");
  }, [requireOptIn]);

  useEffect(() => {
    setCursorStack([undefined]);
    setPageIndex(0);
  }, [q, consentFilter, tagFilter, countryFilter, companyFilter]);

  const filters: ContactListFilters = useMemo(
    () => ({
      q: q.trim() || undefined,
      consent: consentFilter || undefined,
      tag: tagFilter.trim() || undefined,
      country: countryFilter.trim() || undefined,
      company: companyFilter.trim() || undefined,
      suppressed: false,
      sort: "updated",
    }),
    [q, consentFilter, tagFilter, countryFilter, companyFilter]
  );

  const { data, isLoading, isFetching } = useContacts({
    ...filters,
    limit: PAGE_SIZE,
    cursor: cursorStack[pageIndex],
  });

  const contacts = data?.items ?? [];
  const nextCursor = data?.nextCursor;
  const selectedSet = useMemo(() => new Set(selectedPhones), [selectedPhones]);
  const pageSelectedCount = contacts.filter((c) => selectedSet.has(c.phoneNumber)).length;
  const allPageSelected = contacts.length > 0 && pageSelectedCount === contacts.length;
  const somePageSelected = pageSelectedCount > 0 && !allPageSelected;
  const pageStart = contacts.length > 0 ? pageIndex * PAGE_SIZE + 1 : 0;
  const pageEnd = pageIndex * PAGE_SIZE + contacts.length;
  const hasActiveFilters = Boolean(
    q.trim() || consentFilter || tagFilter.trim() || countryFilter.trim() || companyFilter.trim()
  );

  function togglePhone(phone: string) {
    setError("");
    setTruncatedNotice(false);
    if (selectedSet.has(phone)) {
      onChange(selectedPhones.filter((p) => p !== phone));
      return;
    }
    if (selectedPhones.length >= CAMPAIGN_MAX_RECIPIENTS) {
      setError(t("campaigns.contactsPickerMaxReached", { max: CAMPAIGN_MAX_RECIPIENTS }));
      return;
    }
    onChange([...selectedPhones, phone]);
  }

  function togglePageSelection() {
    setError("");
    setTruncatedNotice(false);
    if (allPageSelected) {
      const pagePhones = new Set(contacts.map((c) => c.phoneNumber));
      onChange(selectedPhones.filter((p) => !pagePhones.has(p)));
      return;
    }
    const merged = new Set(selectedPhones);
    for (const contact of contacts) {
      if (merged.size >= CAMPAIGN_MAX_RECIPIENTS) {
        setError(t("campaigns.contactsPickerMaxReached", { max: CAMPAIGN_MAX_RECIPIENTS }));
        break;
      }
      merged.add(contact.phoneNumber);
    }
    onChange(Array.from(merged));
  }

  async function selectAllMatching() {
    setError("");
    setTruncatedNotice(false);
    setSelectingAll(true);
    try {
      const result = await fetchAllMatchingContactPhones(filters, {
        max: CAMPAIGN_MAX_RECIPIENTS,
      });
      onChange(result.phones);
      if (result.truncated) {
        setTruncatedNotice(true);
      }
      if (result.phones.length === 0) {
        setError(t("campaigns.contactsPickerEmptyMatch"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("campaigns.contactsPickerLoadError"));
    } finally {
      setSelectingAll(false);
    }
  }

  function clearSelection() {
    setError("");
    setTruncatedNotice(false);
    onChange([]);
  }

  function clearFilters() {
    setQ("");
    setConsentFilter(requireOptIn ? "opt_in" : "");
    setTagFilter("");
    setCountryFilter("");
    setCompanyFilter("");
  }

  function goNext() {
    if (!nextCursor) return;
    setCursorStack((prev) => {
      const next = prev.slice(0, pageIndex + 1);
      next.push(nextCursor);
      return next;
    });
    setPageIndex((i) => i + 1);
  }

  function goPrev() {
    if (pageIndex === 0) return;
    setPageIndex((i) => i - 1);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ("")}
          placeholder={t("contacts.searchPlaceholder")}
          className="sm:min-w-[200px] sm:flex-1"
        />
        <Select
          value={consentFilter}
          onChange={(e) => setConsentFilter(e.target.value as "" | MarketingConsent)}
          className="sm:w-auto sm:min-w-[150px]"
        >
          <option value="">{t("contacts.filterAllConsent")}</option>
          <option value="opt_in">{t("contacts.consentOptIn")}</option>
          <option value="opt_out">{t("contacts.consentOptOut")}</option>
          <option value="unknown">{t("contacts.consentUnknown")}</option>
        </Select>
        <Input
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          placeholder={t("campaigns.contactsPickerTagFilter")}
          className="sm:w-auto sm:min-w-[140px]"
        />
        <Input
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          placeholder={t("contacts.filterCountry")}
          className="sm:w-auto sm:min-w-[120px]"
        />
        <Input
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          placeholder={t("contacts.filterCompany")}
          className="sm:w-auto sm:min-w-[120px]"
        />
        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            {t("campaigns.contactsPickerClearFilters")}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={togglePageSelection}
            disabled={contacts.length === 0 || selectingAll}
          >
            {allPageSelected ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {allPageSelected
              ? t("campaigns.contactsPickerDeselectPage")
              : t("campaigns.contactsPickerSelectPage")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void selectAllMatching()}
            disabled={selectingAll}
          >
            {selectingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            {hasActiveFilters
              ? t("campaigns.contactsPickerSelectAllFiltered")
              : t("campaigns.contactsPickerSelectAll")}
          </Button>
          {selectedPhones.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              {t("campaigns.contactsPickerClearSelection")}
            </Button>
          )}
        </div>
        <p className="text-xs font-medium text-secondary">
          {selectedPhones.length > 0
            ? t("campaigns.contactsPickerSelected", { count: selectedPhones.length })
            : t("campaigns.contactsPickerNoneSelected")}
        </p>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {truncatedNotice && (
        <Alert variant="warning">
          {t("campaigns.contactsPickerTruncated", { max: CAMPAIGN_MAX_RECIPIENTS })}
        </Alert>
      )}

      <TableContainer className="max-h-72 rounded-lg border border-default">
        <table className="min-w-[420px] w-full text-xs">
          <thead className="sticky top-0 bg-surface">
            <tr>
              <th className="w-10 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = somePageSelected;
                  }}
                  onChange={togglePageSelection}
                  disabled={contacts.length === 0}
                  className="h-3.5 w-3.5 rounded border-default text-accent focus:ring-accent"
                  aria-label={t("campaigns.contactsPickerSelectPage")}
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-secondary">
                {t("contacts.colName")}
              </th>
              <th className="px-3 py-2 text-left font-medium text-secondary">
                {t("common.phone")}
              </th>
              <th className="px-3 py-2 text-left font-medium text-secondary">
                {t("contacts.colTags")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted">
                  {t("common.loading")}
                </td>
              </tr>
            ) : contacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted">
                  {t("campaigns.contactsPickerEmpty")}
                </td>
              </tr>
            ) : (
              contacts.map((contact) => {
                const checked = selectedSet.has(contact.phoneNumber);
                return (
                  <tr
                    key={contact.phoneNumber}
                    className={cn("hover:bg-surface", checked && "bg-accent-muted/30")}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePhone(contact.phoneNumber)}
                        className="h-3.5 w-3.5 rounded border-default text-accent focus:ring-accent"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-primary">
                      {contact.displayName || "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-secondary">{contact.phoneNumber}</td>
                    <td className="px-3 py-2 text-secondary">
                      {contact.tags.length > 0 ? contact.tags.join(", ") : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </TableContainer>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {contacts.length > 0
            ? t("campaigns.contactsPickerPageRange", { from: pageStart, to: pageEnd })
            : null}
          {isFetching && !isLoading ? ` · ${t("common.loading")}` : null}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={goPrev}
            disabled={pageIndex === 0 || selectingAll}
          >
            {t("contacts.previousPage")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={goNext}
            disabled={!nextCursor || selectingAll}
          >
            {t("contacts.nextPage")}
          </Button>
        </div>
      </div>
    </div>
  );
}
