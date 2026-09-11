"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { signOutUser } from "@/lib/auth-session";
import { validatePortalSession } from "@/lib/host-portal";
import { PageLoader } from "@/components/ui/Loader";

export function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuthSession();
  const [portalChecked, setPortalChecked] = useState(false);

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    let cancelled = false;
    validatePortalSession()
      .then(async (result) => {
        if (cancelled) return;
        if (!result.ok) {
          await signOutUser();
          router.replace("/login?error=portal");
          return;
        }
        setPortalChecked(true);
      })
      .catch(async () => {
        if (cancelled) return;
        await signOutUser();
        router.replace("/login?error=portal");
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (loading || isAuthenticated) return;

    const query = searchParams.toString();
    const returnPath = query ? `${pathname}?${query}` : pathname;
    router.replace(`/login?redirect=${encodeURIComponent(returnPath)}`);
  }, [isAuthenticated, loading, pathname, router, searchParams]);

  if (loading || !isAuthenticated || !portalChecked) return <PageLoader />;

  return <>{children}</>;
}
