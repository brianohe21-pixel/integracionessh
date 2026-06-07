"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";

export function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuthSession();

  useEffect(() => {
    if (loading || isAuthenticated) return;

    const query = searchParams.toString();
    const returnPath = query ? `${pathname}?${query}` : pathname;
    router.replace(`/login?redirect=${encodeURIComponent(returnPath)}`);
  }, [isAuthenticated, loading, pathname, router, searchParams]);

  if (loading || !isAuthenticated) return null;

  return <>{children}</>;
}
