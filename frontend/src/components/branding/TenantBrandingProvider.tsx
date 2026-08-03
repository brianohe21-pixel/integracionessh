"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  TENANT_BRANDING_QUERY_KEY,
  seedTenantBrandingCache,
  useTenantBranding,
} from "@/hooks/useTenantBranding";
import { useTheme } from "@/components/theme/ThemeProvider";
import { applyBrandCssVariables, DEFAULT_PRIMARY_COLOR } from "@/lib/brand-colors";
import { api } from "@/lib/api";
import type { Tenant } from "@/types";

export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { isAuthenticated, loading: authLoading } = useAuthSession();
  const { resolvedTheme } = useTheme();
  const brandingEnabled = isAuthenticated && !authLoading;
  const { data } = useTenantBranding(brandingEnabled);

  const { data: me } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: brandingEnabled,
    staleTime: 0,
  });

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      queryClient.removeQueries({ queryKey: TENANT_BRANDING_QUERY_KEY });
      applyBrandCssVariables(DEFAULT_PRIMARY_COLOR);
      return;
    }

    void queryClient.refetchQueries({ queryKey: TENANT_BRANDING_QUERY_KEY });
  }, [authLoading, isAuthenticated, queryClient]);

  useEffect(() => {
    const resolved = me?.resolvedBranding;
    if (resolved?.brandName || resolved?.primaryColor || resolved?.logoUrl) {
      seedTenantBrandingCache(queryClient, {
        brandName: resolved.brandName,
        primaryColor: resolved.primaryColor,
        logoUrl: resolved.logoUrl,
        canCustomize: resolved.canCustomize ?? true,
      });
      return;
    }

    if (me?.branding?.brandName || me?.branding?.primaryColor) {
      seedTenantBrandingCache(queryClient, {
        brandName: me.branding.brandName ?? me.name,
        primaryColor: me.branding.primaryColor ?? DEFAULT_PRIMARY_COLOR,
        canCustomize: true,
      });
    }
  }, [me, queryClient]);

  useEffect(() => {
    const color =
      data?.primaryColor ??
      me?.resolvedBranding?.primaryColor ??
      me?.branding?.primaryColor;
    if (color) {
      applyBrandCssVariables(color);
    }
  }, [
    data?.primaryColor,
    me?.resolvedBranding?.primaryColor,
    me?.branding?.primaryColor,
    resolvedTheme,
  ]);

  return <>{children}</>;
}
