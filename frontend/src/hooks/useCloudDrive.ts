"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type CloudDriveProvider = "google-drive" | "onedrive";

export interface CloudDriveConnectionView {
  connected: boolean;
  configured: boolean;
  enabled: boolean;
  status?: "pending" | "connected" | "error" | "disconnected";
  accountEmail?: string;
  displayName?: string;
  connectedAt?: string;
  lastError?: string;
}

export interface CloudDriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size?: number;
  modifiedAt?: string;
  webUrl?: string;
  parentId?: string;
}

function basePath(provider: CloudDriveProvider): string {
  return `/drive/${provider}`;
}

export function useCloudDriveConnection(provider: CloudDriveProvider) {
  return useQuery({
    queryKey: ["cloud-drive-connection", provider],
    queryFn: () =>
      api.get<CloudDriveConnectionView>(`${basePath(provider)}/connection`),
    staleTime: 30_000,
  });
}

export function useCloudDriveFiles(
  provider: CloudDriveProvider,
  params: { folderId?: string; query?: string; pageToken?: string; enabled?: boolean }
) {
  const search = new URLSearchParams();
  if (params.folderId) search.set("folderId", params.folderId);
  if (params.query) search.set("query", params.query);
  if (params.pageToken) search.set("pageToken", params.pageToken);
  const qs = search.toString();

  return useQuery({
    queryKey: ["cloud-drive-files", provider, params.folderId, params.query, params.pageToken],
    queryFn: () =>
      api.get<{ files: CloudDriveFileItem[]; nextPageToken?: string }>(
        `${basePath(provider)}/files${qs ? `?${qs}` : ""}`
      ),
    enabled: params.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useStartCloudDriveOAuth(provider: CloudDriveProvider) {
  return useMutation({
    mutationFn: () =>
      api.post<{ authUrl: string; state: string }>(`${basePath(provider)}/oauth/start`, {}),
  });
}

export function useUpdateCloudDriveConnection(provider: CloudDriveProvider) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { enabled?: boolean }) =>
      api.patch<CloudDriveConnectionView>(`${basePath(provider)}/connection`, body),
    onSuccess: (data) => {
      queryClient.setQueryData(["cloud-drive-connection", provider], data);
      queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  });
}

export function useDisconnectCloudDrive(provider: CloudDriveProvider) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete<CloudDriveConnectionView>(`${basePath(provider)}/connection`),
    onSuccess: (data) => {
      queryClient.setQueryData(["cloud-drive-connection", provider], data);
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      queryClient.invalidateQueries({ queryKey: ["cloud-drive-files", provider] });
    },
  });
}

export function useUploadCloudDriveFile(provider: CloudDriveProvider) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      mimeType: string;
      contentBase64: string;
      parentId?: string;
    }) => api.post<CloudDriveFileItem>(`${basePath(provider)}/files`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cloud-drive-files", provider] });
    },
  });
}

export function useCreateCloudDriveFolder(provider: CloudDriveProvider) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; parentId?: string }) =>
      api.post<CloudDriveFileItem>(`${basePath(provider)}/folders`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cloud-drive-files", provider] });
    },
  });
}

export function useUpdateCloudDriveFile(provider: CloudDriveProvider) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fileId: string;
      name?: string;
      mimeType?: string;
      contentBase64?: string;
    }) => {
      const { fileId, ...body } = input;
      return api.patch<CloudDriveFileItem>(`${basePath(provider)}/files/${encodeURIComponent(fileId)}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cloud-drive-files", provider] });
    },
  });
}
