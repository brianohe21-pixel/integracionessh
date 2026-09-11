"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tenant } from "@/types";
import { MEMBER_HOME } from "@/lib/post-login-path";
import {
  isSubaccountServiceEnabled,
  serviceForPath,
} from "@/lib/subaccount-services";
import { useAdminRole } from "@/hooks/useAdminRole";
import { ContentLoader } from "@/components/ui/Loader";

export function SubaccountServiceGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, loading: adminLoading } = useAdminRole();
  const { data: me, isLoading } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: !isAdmin,
  });

  const service = serviceForPath(pathname);
  const allowed = !service || isSubaccountServiceEnabled(me, service);

  useEffect(() => {
    if (adminLoading || isLoading || isAdmin) return;
    if (!allowed) router.replace(MEMBER_HOME);
  }, [adminLoading, allowed, isAdmin, isLoading, router]);

  if (adminLoading || (!isAdmin && isLoading)) return <ContentLoader />;
  if (!isAdmin && !allowed) return <ContentLoader />;

  return <>{children}</>;
}
