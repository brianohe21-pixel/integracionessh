import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { DashboardAuthGuard } from "@/components/layout/DashboardAuthGuard";
import { DashboardRoleGuard } from "@/components/layout/DashboardRoleGuard";
import { SubaccountServiceGuard } from "@/components/layout/SubaccountServiceGuard";
import { TermsAcceptanceSync } from "@/components/legal/TermsAcceptanceSync";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { HelpCenterMount } from "@/components/help-center/HelpCenterMount";
import { ConversationRealtimeProvider } from "@/components/realtime/ConversationRealtimeProvider";
import { SoftphoneProvider } from "@/components/contact-center/SoftphoneProvider";
import { SoftphoneBar } from "@/components/contact-center/SoftphoneBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SidebarProvider>
        <DashboardAuthGuard>
          <ConversationRealtimeProvider>
            <SoftphoneProvider>
            <div className="flex h-screen overflow-hidden">
            <TermsAcceptanceSync />
            <Sidebar />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <MobileTopBar />
              <div className="border-b border-default px-4 py-2">
                <SoftphoneBar />
              </div>
              <main className="canvas-bg min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                <OnboardingGate>
                  <HelpCenterMount>
                    <DashboardRoleGuard>
                      <SubaccountServiceGuard>{children}</SubaccountServiceGuard>
                    </DashboardRoleGuard>
                  </HelpCenterMount>
                </OnboardingGate>
              </main>
            </div>
            </div>
            </SoftphoneProvider>
          </ConversationRealtimeProvider>
        </DashboardAuthGuard>
      </SidebarProvider>
    </Suspense>
  );
}
