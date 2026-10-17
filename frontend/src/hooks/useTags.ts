"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TagAction, TagDefinition } from "@/types";

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => api.get<{ items: TagDefinition[] }>("/sales/tags"),
    select: (data) => data.items,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      color?: string;
      description?: string;
      onApply?: TagAction[];
    }) => api.post<TagDefinition>("/sales/tags", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tagId,
      ...body
    }: {
      tagId: string;
      name?: string;
      color?: string | null;
      description?: string | null;
      onApply?: TagAction[];
    }) => api.put<TagDefinition>(`/sales/tags/${encodeURIComponent(tagId)}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) =>
      api.delete(`/sales/tags/${encodeURIComponent(tagId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}
