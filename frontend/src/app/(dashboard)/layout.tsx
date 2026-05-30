import { Sidebar } from "@/components/layout/Sidebar";
import { TermsAcceptanceSync } from "@/components/legal/TermsAcceptanceSync";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <TermsAcceptanceSync />
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
