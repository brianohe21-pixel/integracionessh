"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminRole } from "@/hooks/useAdminRole";
import { MEMBER_HOME } from "@/lib/post-login-path";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAdmin, loading } = useAdminRole();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace(MEMBER_HOME);
    }
  }, [isAdmin, loading, router]);

  if (loading || !isAdmin) return null;

  return <>{children}</>;
}
