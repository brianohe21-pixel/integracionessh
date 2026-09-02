"use client";

import { HelpCenterButton } from "@/components/help-center/HelpCenterButton";
import { useTenantRole } from "@/hooks/useTenantRole";

export function HelpCenterToolbarTrigger() {
  const { isMember, loading } = useTenantRole();

  if (loading || !isMember) return null;

  return <HelpCenterButton />;
}
