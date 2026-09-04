"use client";

import type { ReactNode } from "react";
import { HelpCenterPanel } from "@/components/help-center/HelpCenterPanel";
import { HelpCenterProvider } from "@/components/help-center/HelpCenterProvider";
import { useTenantRole } from "@/hooks/useTenantRole";

export function HelpCenterMount({ children }: { children: ReactNode }) {
  const { isMember, loading } = useTenantRole();

  if (loading || !isMember) return <>{children}</>;

  return (
    <HelpCenterProvider>
      {children}
      <HelpCenterPanel />
    </HelpCenterProvider>
  );
}
