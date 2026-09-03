import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { PlatformToolbar } from "@/components/layout/PlatformToolbar";
import { DashboardAuthGuard } from "@/components/layout/DashboardAuthGuard";
import { DashboardRoleGuard } from "@/components/layout/DashboardRoleGuard";
import { SubaccountServiceGuard } from "@/components/layout/SubaccountServiceGuard";
import { TermsAcceptanceSync } from "@/components/legal/TermsAcceptanceSync";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { HelpCenterMount } from "@/components/help-center/HelpCenterMount";
import { NotificationsMount } from "@/components/notifications/NotificationsMount";
import { UnreadMessagesProvider } from "@/components/notifications/UnreadMessagesProvider";
import { ConversationRealtimeProvider } from "@/components/realtime/ConversationRealtimeProvider";
import { SoftphoneProvider } from "@/components/contact-center/SoftphoneProvider";
import { SoftphoneUIProvider } from "@/components/contact-center/SoftphoneUIProvider";
import { SoftphoneBar } from "@/components/contact-center/SoftphoneBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SidebarProvider>
        <DashboardAuthGuard>
          <ConversationRealtimeProvider>
            <UnreadMessagesProvider>
              <NotificationsMount>
                <SoftphoneProvider>
                  <SoftphoneUIProvider>
                    <div className="flex h-screen overflow-x-clip">
                      <TermsAcceptanceSync />
                      <Sidebar />
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden platform-canvas-bg">
                        <HelpCenterMount>
                          <MobileTopBar />
                          <PlatformToolbar />
                          <SoftphoneBar />
                          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto platform-canvas-bg">
                            <div className="flex min-h-full flex-1 flex-col">
                              <OnboardingGate>
                                <DashboardRoleGuard>
                                  <SubaccountServiceGuard>{children}</SubaccountServiceGuard>
                                </DashboardRoleGuard>
                              </OnboardingGate>
                            </div>
                          </main>
                        </HelpCenterMount>
                      </div>
                    </div>
                  </SoftphoneUIProvider>
                </SoftphoneProvider>
              </NotificationsMount>
            </UnreadMessagesProvider>
          </ConversationRealtimeProvider>
        </DashboardAuthGuard>
      </SidebarProvider>
    </Suspense>
  );
}
