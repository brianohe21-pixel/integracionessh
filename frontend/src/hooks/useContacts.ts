"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenantContextId } from "@/hooks/useActiveTenant";
import { api } from "@/lib/api";
import type {
  Contact,
  ContactDateField,
  ContactMetrics,
  ContactSortField,
  ContactsListResponse,
  MarketingConsent,
} from "@/types";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export const CAMPAIGN_MAX_RECIPIENTS = 5000;

export type ContactListFilters = {
  tag?: string;
  consent?: MarketingConsent;
  suppressed?: boolean;
  q?: string;
  country?: string;
  company?: string;
  botId?: string;
  sort?: ContactSortField;
  dateField?: ContactDateField;
  from?: string;
  to?: string;
};

async function getAuthHeader(): Promise<Record<string, string>> {
  const { fetchAuthSession } = await import("aws-amplify/auth");
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

function buildContactsQuery(
  options?: ContactListFilters & { limit?: number; cursor?: string }
): string {
  const params = new URLSearchParams();
  if (options?.tag) params.set("tag", options.tag);
  if (options?.consent) params.set("consent", options.consent);
  if (options?.suppressed !== undefined) params.set("suppressed", String(options.suppressed));
  if (options?.q) params.set("q", options.q);
  if (options?.country) params.set("country", options.country);
  if (options?.company) params.set("company", options.company);
  if (options?.botId) params.set("botId", options.botId);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.dateField) params.set("dateField", options.dateField);
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useContacts(options?: ContactListFilters & { limit?: number; cursor?: string }) {
  const qs = buildContactsQuery(options);

  return useQuery({
    queryKey: ["contacts", options],
    queryFn: () => api.get<ContactsListResponse>(`/contacts${qs}`),
  });
}

export async function fetchAllMatchingContactPhones(
  filters: ContactListFilters,
  options?: { max?: number }
): Promise<{ phones: string[]; truncated: boolean; totalFetched: number }> {
  const max = options?.max ?? CAMPAIGN_MAX_RECIPIENTS;
  const phones: string[] = [];
  let cursor: string | undefined;
  let truncated = false;

  do {
    const qs = buildContactsQuery({
      ...filters,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    const page = await api.get<ContactsListResponse>(`/contacts${qs}`);
    for (const contact of page.items) {
      if (phones.length >= max) {
        truncated = true;
        break;
      }
      phones.push(contact.phoneNumber);
    }
    if (truncated) break;
    cursor = page.nextCursor;
  } while (cursor);

  return { phones, truncated, totalFetched: phones.length };
}

export function useContactMetrics() {
  const scope = useTenantContextId() ?? "home";
  return useQuery({
    queryKey: ["metrics", "contacts", scope],
    queryFn: () => api.get<ContactMetrics>("/metrics/contacts"),
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      phoneNumber: string;
      displayName?: string;
      country?: string;
      company?: string;
      tags?: string[];
      marketingConsent?: MarketingConsent;
    }) => api.post<Contact>("/contacts", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["metrics", "contacts"] });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      phone,
      ...body
    }: {
      phone: string;
      displayName?: string;
      email?: string;
      country?: string;
      company?: string;
      tags?: string[];
      notes?: string;
      marketingConsent?: MarketingConsent;
      suppressed?: boolean;
    }) => api.patch<Contact>(`/contacts/${encodeURIComponent(phone)}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["metrics", "contacts"] });
    },
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Array<{
      phone: string;
      name?: string;
      country?: string;
      company?: string;
      tags?: string[];
      marketingConsent?: MarketingConsent;
    }>) => api.post<{ created: number; updated: number }>("/contacts/import", { rows }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["metrics", "contacts"] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phone: string) => api.delete(`/contacts/${encodeURIComponent(phone)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["metrics", "contacts"] });
    },
  });
}

export async function downloadContactsExport(type: "suppressed" | "opt_out" | "all") {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${BASE_URL}/contacts/export?type=${type}`, {
    headers: authHeader,
  });
  if (!response.ok) throw new Error("Export failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contacts-${type}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
