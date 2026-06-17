"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Contact, ContactsListResponse, MarketingConsent } from "@/types";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

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

export function useContacts(options?: {
  tag?: string;
  consent?: MarketingConsent;
  suppressed?: boolean;
  q?: string;
  cursor?: string;
}) {
  const params = new URLSearchParams();
  if (options?.tag) params.set("tag", options.tag);
  if (options?.consent) params.set("consent", options.consent);
  if (options?.suppressed !== undefined) params.set("suppressed", String(options.suppressed));
  if (options?.q) params.set("q", options.q);
  if (options?.cursor) params.set("cursor", options.cursor);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery({
    queryKey: ["contacts", options],
    queryFn: () => api.get<ContactsListResponse>(`/contacts${qs}`),
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      phoneNumber: string;
      displayName?: string;
      tags?: string[];
      marketingConsent?: MarketingConsent;
    }) => api.post<Contact>("/contacts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
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
      tags?: string[];
      marketingConsent?: MarketingConsent;
      suppressed?: boolean;
    }) => api.patch<Contact>(`/contacts/${encodeURIComponent(phone)}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Array<{
      phone: string;
      name?: string;
      tags?: string[];
      marketingConsent?: MarketingConsent;
    }>) => api.post<{ created: number; updated: number }>("/contacts/import", { rows }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phone: string) => api.delete(`/contacts/${encodeURIComponent(phone)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
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
