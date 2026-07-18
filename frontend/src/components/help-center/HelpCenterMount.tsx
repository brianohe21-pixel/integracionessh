"use client";

import type { ReactNode } from "react";
import { HelpCenterButton } from "@/components/help-center/HelpCenterButton";
import { HelpCenterPanel } from "@/components/help-center/HelpCenterPanel";
import { HelpCenterProvider } from "@/components/help-center/HelpCenterProvider";
import { useTenantRole } from "@/hooks/useTenantRole";

export function HelpCenterMount({ children }: { children: ReactNode }) {
  const { isMember, loading } = useTenantRole();

  if (loading || !isMember) return <>{children}</>;

  return (
    <HelpCenterProvider>
      {children}
      <HelpCenterButton />
      <HelpCenterPanel />
    </HelpCenterProvider>
  );
}
