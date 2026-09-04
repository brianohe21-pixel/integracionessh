"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

function slugifyCompanyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "company";
}

export function useDownloadAdminSentMessagesCsv() {
  return useMutation({
    mutationFn: async (input: { tenantId: string; tenantName: string; period: string }) => {
      const slug = slugifyCompanyName(input.tenantName);
      const filename = `sent-messages-${slug}-${input.period}.csv`;
      await api.download(
        `/admin/reports/messages/export?tenantId=${encodeURIComponent(input.tenantId)}&period=${encodeURIComponent(input.period)}`,
        filename
      );
    },
  });
}
