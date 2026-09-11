"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminRole } from "@/hooks/useAdminRole";
import { ADMIN_HOME, MEMBER_HOME } from "@/lib/post-login-path";
import { ContentLoader } from "@/components/ui/Loader";

export function DashboardRoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, loading } = useAdminRole();

  useEffect(() => {
    if (loading) return;
    if (isAdmin && !pathname.startsWith("/admin")) {
      router.replace(ADMIN_HOME);
      return;
    }
    if (!isAdmin && pathname.startsWith("/admin")) {
      router.replace(MEMBER_HOME);
    }
  }, [isAdmin, loading, pathname, router]);

  if (loading) return <ContentLoader />;
  if (isAdmin && !pathname.startsWith("/admin")) return <ContentLoader />;
  if (!isAdmin && pathname.startsWith("/admin")) return <ContentLoader />;

  return <>{children}</>;
}
