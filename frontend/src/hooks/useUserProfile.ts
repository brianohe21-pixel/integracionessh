"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UserProfile } from "@/types";

export const USER_PROFILE_QUERY_KEY = ["user-profile"] as const;

const MAX_PHOTO_BYTES = 1_500_000;

function normalizePhotoContentType(contentType: string): string {
  const normalized = contentType.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  switch (normalized) {
    case "image/png":
    case "image/x-png":
      return "image/png";
    case "image/jpeg":
    case "image/jpg":
    case "image/pjpeg":
      return "image/jpeg";
    case "image/webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read photo file"));
    reader.readAsDataURL(file);
  });
}

export function useUserProfile(enabled = true) {
  return useQuery({
    queryKey: USER_PROFILE_QUERY_KEY,
    queryFn: () => api.get<UserProfile>("/tenants/me/profile"),
    enabled,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useUploadProfilePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_PHOTO_BYTES) {
        throw new Error("Photo must be 1.5MB or smaller");
      }
      const contentType = normalizePhotoContentType(file.type || "image/png");
      const data = await fileToBase64(file);
      return api.post<UserProfile>("/tenants/me/profile/photo", { contentType, data });
    },
    onSuccess: (data) => {
      queryClient.setQueryData<UserProfile>(USER_PROFILE_QUERY_KEY, data);
    },
  });
}

export function useDeleteProfilePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<UserProfile>("/tenants/me/profile/photo"),
    onSuccess: (data) => {
      queryClient.setQueryData<UserProfile>(USER_PROFILE_QUERY_KEY, data);
    },
  });
}
