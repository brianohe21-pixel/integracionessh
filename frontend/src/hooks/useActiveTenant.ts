"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, getTenantContext } from "@/lib/api";
import type { Tenant } from "@/types";

export function useTenantContextId(): string | null {
  const pathname = usePathname();
  const [tenantContext, setTenantContext] = useState<string | null>(() => getTenantContext());

  useEffect(() => {
    setTenantContext(getTenantContext());
  }, [pathname]);

  return tenantContext;
}

export function useActiveTenant(enabled = true) {
  const tenantContext = useTenantContextId();
  const query = useQuery({
    queryKey: ["tenants", "me", tenantContext ?? "home"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled,
  });

  return { ...query, tenantContext };
}

export function activeWorkspaceLabel(tenant: Tenant | undefined): string {
  return tenant?.name?.trim() || tenant?.branding?.brandName?.trim() || "";
}
