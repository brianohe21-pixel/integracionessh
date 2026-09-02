"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface GoogleBusinessLocation {
  id: string;
  name: string;
  address?: string;
}

export interface GoogleBusinessView {
  id: "google-business-profile";
  configured: boolean;
  enabled: boolean;
  status?: "pending" | "active" | "error";
  googleAccountEmail?: string;
  googleAccountId?: string;
  selectedLocationIds: string[];
  locations: GoogleBusinessLocation[];
  connectedAt?: string;
}

export interface GoogleReview {
  reviewId: string;
  name: string;
  reviewer?: {
    displayName?: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: {
    comment?: string;
    updateTime?: string;
  };
}

export interface GoogleReviewsResponse {
  reviews: GoogleReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

export function useGoogleBusiness() {
  return useQuery({
    queryKey: ["google-business-profile"],
    queryFn: () =>
      api.get<GoogleBusinessView>("/tenants/me/integrations/google-business-profile"),
    staleTime: 30_000,
  });
}

export function useStartGoogleBusinessOAuth() {
  return useMutation({
    mutationFn: () =>
      api.get<{ authUrl: string; state: string }>(
        "/tenants/me/integrations/google-business-profile/oauth/start"
      ),
  });
}

export function useUpdateGoogleBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { enabled?: boolean; selectedLocationIds?: string[] }) =>
      api.patch<GoogleBusinessView>(
        "/tenants/me/integrations/google-business-profile",
        body
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-business-profile"], data);
      queryClient.invalidateQueries({ queryKey: ["integration-catalog"] });
    },
  });
}

export function useRefreshGoogleBusinessLocations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<GoogleBusinessView>(
        "/tenants/me/integrations/google-business-profile/locations/refresh",
        {}
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-business-profile"], data);
    },
  });
}

export function useDeleteGoogleBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.delete<GoogleBusinessView>("/tenants/me/integrations/google-business-profile"),
    onSuccess: (data) => {
      queryClient.setQueryData(["google-business-profile"], data);
      queryClient.invalidateQueries({ queryKey: ["integration-catalog"] });
    },
  });
}

export function useGoogleBusinessLocations() {
  return useQuery({
    queryKey: ["google-business-locations"],
    queryFn: () => api.get<{ locations: GoogleBusinessLocation[] }>("/google-business/locations"),
    staleTime: 30_000,
  });
}

export function useGoogleReviews(
  locationId: string | null,
  options?: { pageToken?: string; orderBy?: string }
) {
  return useQuery({
    queryKey: ["google-business-reviews", locationId, options?.pageToken, options?.orderBy],
    enabled: Boolean(locationId),
    queryFn: () => {
      const params = new URLSearchParams({ locationId: locationId ?? "" });
      if (options?.pageToken) params.set("pageToken", options.pageToken);
      if (options?.orderBy) params.set("orderBy", options.orderBy);
      return api.get<GoogleReviewsResponse>(`/google-business/reviews?${params.toString()}`);
    },
    staleTime: 15_000,
  });
}

export function useReplyToGoogleReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { locationId: string; reviewId: string; comment: string }) =>
      api.put<{ comment: string; updateTime?: string }>(
        `/google-business/reviews/${encodeURIComponent(body.reviewId)}/reply`,
        { locationId: body.locationId, comment: body.comment }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-business-reviews"] });
    },
  });
}

export function useDeleteGoogleReviewReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { locationId: string; reviewId: string }) => {
      const params = new URLSearchParams({ locationId: body.locationId });
      return api.delete<void>(
        `/google-business/reviews/${encodeURIComponent(body.reviewId)}/reply?${params.toString()}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-business-reviews"] });
    },
  });
}

export function starRatingToNumber(rating?: string): number {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return map[rating ?? ""] ?? 0;
}
