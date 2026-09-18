import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
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
import { PageLoader } from "@/components/ui/Loader";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <SidebarProvider>
        <DashboardAuthGuard>
          <ConversationRealtimeProvider>
            <UnreadMessagesProvider>
              <NotificationsMount>
                <SoftphoneProvider>
                  <SoftphoneUIProvider>
                    <div className="flex h-screen flex-col overflow-hidden platform-canvas-bg">
                      <TermsAcceptanceSync />
                      <HelpCenterMount>
                        <PlatformToolbar />
                        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                          <div className="flex h-full shrink-0 flex-col lg:[&>aside]:min-h-0 lg:[&>aside]:flex-1">
                            <Sidebar />
                          </div>
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden platform-canvas-bg">
                            <SoftphoneBar />
                            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden platform-canvas-bg">
                              <div className="flex min-h-0 flex-1 flex-col">
                                <OnboardingGate>
                                  <DashboardRoleGuard>
                                    <SubaccountServiceGuard>{children}</SubaccountServiceGuard>
                                  </DashboardRoleGuard>
                                </OnboardingGate>
                              </div>
                            </main>
                          </div>
                        </div>
                      </HelpCenterMount>
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
