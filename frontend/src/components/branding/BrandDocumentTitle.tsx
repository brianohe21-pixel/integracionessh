"use client";

import { useEffect } from "react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { useT } from "@/i18n/context";

export function BrandDocumentTitle() {
  const t = useT();
  const { isAuthenticated, loading: authLoading } = useAuthSession();
  const { data } = useTenantBranding(isAuthenticated && !authLoading);

  useEffect(() => {
    const name = data?.brandName ?? t("common.appName");
    document.title = name;
  }, [data?.brandName, t]);

  return null;
}
