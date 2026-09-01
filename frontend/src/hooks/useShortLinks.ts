import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ShortLink, ShortLinkClick, ShortLinkUtm } from "@/types";

export type ShortLinkInput = {
  name: string;
  destinationUrl: string;
  slug?: string;
  enabled?: boolean;
  campaignId?: string;
  utm?: ShortLinkUtm;
  expiresAt?: string;
};

export type ShortLinkUpdateInput = Partial<ShortLinkInput>;

export function useShortLinks() {
  return useQuery({
    queryKey: ["short-links"],
    queryFn: () => api.get<{ items: ShortLink[] }>("/short-links/list"),
  });
}

export function useShortLink(linkId: string) {
  return useQuery({
    queryKey: ["short-links", linkId],
    queryFn: () => api.get<ShortLink>(`/short-links/${encodeURIComponent(linkId)}`),
    enabled: Boolean(linkId),
  });
}

export function useShortLinkClicks(linkId: string) {
  return useQuery({
    queryKey: ["short-links", linkId, "clicks"],
    queryFn: () =>
      api.get<{ items: ShortLinkClick[] }>(
        `/short-links/${encodeURIComponent(linkId)}/clicks`
      ),
    enabled: Boolean(linkId),
  });
}

export function useCreateShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ShortLinkInput) => api.post<ShortLink>("/short-links/create", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["short-links"] }),
  });
}

export function useUpdateShortLink(linkId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ShortLinkUpdateInput) =>
      api.patch<ShortLink>(`/short-links/${encodeURIComponent(linkId)}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["short-links"] });
      void qc.invalidateQueries({ queryKey: ["short-links", linkId] });
    },
  });
}

export function useDeleteShortLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      api.delete(`/short-links/${encodeURIComponent(linkId)}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["short-links"] }),
  });
}
