"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getPostLoginPath } from "@/lib/post-login-path";
import { validatePortalSession } from "@/lib/host-portal";
import { signOutUser } from "@/lib/auth-session";
import { useT } from "@/i18n/context";
import { PageLoader } from "@/components/ui/Loader";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuthSession();
  const t = useT();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    void (async () => {
      const portalCheck = await validatePortalSession();
      if (cancelled) return;
      if (!portalCheck.ok) {
        await signOutUser();
        router.replace("/login?error=portal");
        return;
      }
      router.replace(await getPostLoginPath());
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loading, router]);

  return <PageLoader label={t("common.loading")} />;
}
