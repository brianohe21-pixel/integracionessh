"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type MicrosoftSsoProtocol = "oidc" | "saml";

export interface IntegrationCatalogItem {
  id: "microsoft-sso" | "google-business-profile";
  configured: boolean;
  enabled: boolean;
  status?: "pending" | "active" | "error";
}

export const INTEGRATION_CATALOG_DEFAULTS: IntegrationCatalogItem[] = [
  { id: "microsoft-sso", configured: false, enabled: false },
  { id: "google-business-profile", configured: false, enabled: false },
];

export function mergeIntegrationCatalog(
  apiItems: IntegrationCatalogItem[] | undefined
): IntegrationCatalogItem[] {
  const byId = new Map((apiItems ?? []).map((item) => [item.id, item]));
  return INTEGRATION_CATALOG_DEFAULTS.map((defaultItem) => ({
    ...defaultItem,
    ...byId.get(defaultItem.id),
  }));
}

export interface MicrosoftSsoView {
  id: "microsoft-sso";
  configured: boolean;
  enabled: boolean;
  protocol?: MicrosoftSsoProtocol;
  status?: "pending" | "active" | "error";
  entraTenantId?: string;
  clientId?: string;
  clientSecretMasked?: string;
  metadataUrl?: string;
  allowedDomains?: string[];
  enforceSso?: boolean;
  cognitoProviderName?: string;
  redirectUri?: string;
  samlAcsUrl?: string;
  samlEntityId?: string;
  appCallbackUrl?: string;
  lastTestedAt?: string;
  lastTestStatus?: "success" | "failed";
  lastTestMessage?: string;
}

export interface PublicAuthMethods {
  password: boolean;
  google: boolean;
  microsoft: {
    enabled: boolean;
    providerName: string;
    enforceSso: boolean;
  } | null;
}

export function useIntegrationCatalog() {
  return useQuery({
    queryKey: ["integration-catalog"],
    queryFn: () => api.get<{ items: IntegrationCatalogItem[] }>("/tenants/me/integrations"),
    staleTime: 30_000,
  });
}

export function useMicrosoftSso() {
  return useQuery({
    queryKey: ["microsoft-sso"],
    queryFn: () => api.get<MicrosoftSsoView>("/tenants/me/integrations/microsoft-sso"),
    staleTime: 30_000,
  });
}

export function useSaveMicrosoftSso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      protocol: MicrosoftSsoProtocol;
      enabled?: boolean;
      entraTenantId?: string;
      clientId?: string;
      clientSecret?: string;
      metadataUrl?: string;
      allowedDomains?: string[];
      enforceSso?: boolean;
    }) => api.put<MicrosoftSsoView>("/tenants/me/integrations/microsoft-sso", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["microsoft-sso"], data);
      queryClient.invalidateQueries({ queryKey: ["integration-catalog"] });
    },
  });
}

export function useToggleMicrosoftSso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch<MicrosoftSsoView>("/tenants/me/integrations/microsoft-sso", { enabled }),
    onSuccess: (data) => {
      queryClient.setQueryData(["microsoft-sso"], data);
      queryClient.invalidateQueries({ queryKey: ["integration-catalog"] });
    },
  });
}

export function useTestMicrosoftSso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<MicrosoftSsoView>("/tenants/me/integrations/microsoft-sso/test", {}),
    onSuccess: (data) => {
      queryClient.setQueryData(["microsoft-sso"], data);
      queryClient.invalidateQueries({ queryKey: ["integration-catalog"] });
    },
  });
}

export function useDeleteMicrosoftSso() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<MicrosoftSsoView>("/tenants/me/integrations/microsoft-sso"),
    onSuccess: (data) => {
      queryClient.setQueryData(["microsoft-sso"], data);
      queryClient.invalidateQueries({ queryKey: ["integration-catalog"] });
    },
  });
}

export function usePublicAuthMethods(host: string | null) {
  return useQuery({
    queryKey: ["public-auth-methods", host],
    enabled: Boolean(host),
    queryFn: () =>
      api.getPublic<PublicAuthMethods>(
        `/public/auth-methods?host=${encodeURIComponent(host ?? "")}`
      ),
    staleTime: 60_000,
  });
}
