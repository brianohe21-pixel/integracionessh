"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { BotMessageSquare } from "lucide-react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useResellerSubaccounts } from "@/hooks/useReseller";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { api, getTenantContext } from "@/lib/api";
import { readPortalBrandingFromCookies } from "@/lib/platform-brand";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/types";

export function TenantBrand({ className }: { className?: string }) {
  const t = useT();
  const { isAuthenticated, loading: authLoading } = useAuthSession();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const brandingEnabled = isAuthenticated && !authLoading && !adminLoading && !isAdmin;
  const { data: branding } = useTenantBranding(brandingEnabled);
  const { data: me } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: isAuthenticated && !authLoading && !isAdmin,
  });
  const [assumedId, setAssumedId] = useState<string | null>(() => getTenantContext());
  const [portalBranding, setPortalBranding] = useState(() => readPortalBrandingFromCookies());

  const isResellerTenant = me?.plan === "reseller" || me?.tenantKind === "reseller";
  const isSubaccountTenant = me?.tenantKind === "subaccount" || Boolean(me?.parentTenantId);
  const canManageSubaccounts = !isAdmin && (isResellerTenant || isSubaccountTenant);
  const { data: subaccountsData } = useResellerSubaccounts(canManageSubaccounts);
  const subaccounts = canManageSubaccounts ? (subaccountsData?.items ?? []) : [];

  useEffect(() => {
    setAssumedId(getTenantContext());
  }, [me, subaccountsData]);

  useEffect(() => {
    setPortalBranding(readPortalBrandingFromCookies());
  }, []);

  const assumedSubaccount = assumedId
    ? subaccounts.find((item) => item.tenantId === assumedId)
    : undefined;

  const isWhiteLabelPortal = Boolean(portalBranding.brandName || portalBranding.logoUrl);

  const tenantName = (
    assumedSubaccount?.name ||
    (isWhiteLabelPortal ? portalBranding.brandName : undefined) ||
    branding?.brandName ||
    me?.resolvedBranding?.brandName ||
    me?.branding?.brandName ||
    ""
  ).trim();
  const displayName = tenantName || me?.name?.trim() || t("common.appName");
  const logoUrl = isWhiteLabelPortal
    ? portalBranding.logoUrl ?? branding?.logoUrl ?? me?.resolvedBranding?.logoUrl
    : branding?.logoUrl ?? me?.resolvedBranding?.logoUrl;

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md",
          logoUrl ? "bg-white p-0.5" : "bg-white/10"
        )}
      >
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={28}
            height={28}
            unoptimized
            className="max-h-full max-w-full object-contain"
            key={logoUrl}
          />
        ) : (
          <BotMessageSquare className="h-4 w-4 text-white" />
        )}
      </div>
      <p className="truncate text-[15px] font-semibold tracking-tight text-white">{displayName}</p>
    </div>
  );
}
