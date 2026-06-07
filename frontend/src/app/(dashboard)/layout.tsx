import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardAuthGuard } from "@/components/layout/DashboardAuthGuard";
import { DashboardRoleGuard } from "@/components/layout/DashboardRoleGuard";
import { TermsAcceptanceSync } from "@/components/legal/TermsAcceptanceSync";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <DashboardAuthGuard>
        <div className="flex min-h-screen">
          <TermsAcceptanceSync />
          <Sidebar />
          <main className="flex-1 overflow-auto bg-gray-50">
            <DashboardRoleGuard>{children}</DashboardRoleGuard>
          </main>
        </div>
      </DashboardAuthGuard>
    </Suspense>
  );
}
