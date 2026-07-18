import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { DashboardAuthGuard } from "@/components/layout/DashboardAuthGuard";
import { DashboardRoleGuard } from "@/components/layout/DashboardRoleGuard";
import { TermsAcceptanceSync } from "@/components/legal/TermsAcceptanceSync";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { HelpCenterMount } from "@/components/help-center/HelpCenterMount";
import { ConversationRealtimeProvider } from "@/components/realtime/ConversationRealtimeProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SidebarProvider>
        <DashboardAuthGuard>
          <ConversationRealtimeProvider>
            <div className="flex h-screen overflow-hidden">
            <TermsAcceptanceSync />
            <Sidebar />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <MobileTopBar />
              <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-surface">
                <OnboardingGate>
                  <HelpCenterMount>
                    <DashboardRoleGuard>{children}</DashboardRoleGuard>
                  </HelpCenterMount>
                </OnboardingGate>
              </main>
            </div>
            </div>
          </ConversationRealtimeProvider>
        </DashboardAuthGuard>
      </SidebarProvider>
    </Suspense>
  );
}
