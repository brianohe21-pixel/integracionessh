import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardRoleGuard } from "@/components/layout/DashboardRoleGuard";
import { TermsAcceptanceSync } from "@/components/legal/TermsAcceptanceSync";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <TermsAcceptanceSync />
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        <DashboardRoleGuard>{children}</DashboardRoleGuard>
      </main>
    </div>
  );
}
