"use client";

import { useEffect } from "react";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { useT } from "@/i18n/context";

export function BrandDocumentTitle() {
  const t = useT();
  const { data } = useTenantBranding();

  useEffect(() => {
    const name = data?.brandName ?? t("common.appName");
    document.title = name;
  }, [data?.brandName, t]);

  return null;
}
