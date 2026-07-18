"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTenantRole } from "@/hooks/useTenantRole";
import type { Tenant } from "@/types";

const EXCLUDED_PREFIXES = ["/onboarding", "/billing", "/admin"];

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMember, loading: roleLoading } = useTenantRole();

  const excluded = EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: isMember && !excluded,
  });

  useEffect(() => {
    if (roleLoading || tenantLoading || !isMember || excluded) return;
    if (!tenant) return;

    const needsOnboarding =
      !tenant.onboardingCompletedAt && !tenant.onboardingSkippedAt;

    if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [roleLoading, tenantLoading, isMember, excluded, tenant, router]);

  return children;
}
