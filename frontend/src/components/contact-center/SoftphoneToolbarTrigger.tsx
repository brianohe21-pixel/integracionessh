"use client";

import { useQuery } from "@tanstack/react-query";
import { SoftphoneTrigger } from "@/components/contact-center/SoftphoneTrigger";
import { useAdminRole } from "@/hooks/useAdminRole";
import { api } from "@/lib/api";
import { isSubaccountServiceEnabled } from "@/lib/subaccount-services";
import type { Tenant } from "@/types";

export function SoftphoneToolbarTrigger() {
  const { isAdmin } = useAdminRole();
  const { data: me } = useQuery({
    queryKey: ["tenants", "me"],
    queryFn: () => api.get<Tenant>("/tenants/me"),
    enabled: !isAdmin,
  });

  if (!isSubaccountServiceEnabled(me, "contactCenter")) return null;

  return <SoftphoneTrigger />;
}
