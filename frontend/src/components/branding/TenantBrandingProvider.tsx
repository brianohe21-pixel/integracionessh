"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { applyBrandCssVariables, DEFAULT_PRIMARY_COLOR } from "@/lib/brand-colors";

export function TenantBrandingProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetchAuthSession()
      .then((session) => setAuthed(Boolean(session.tokens?.idToken)))
      .catch(() => setAuthed(false));
  }, []);

  const { data } = useTenantBranding(authed);

  useEffect(() => {
    const color = data?.primaryColor ?? DEFAULT_PRIMARY_COLOR;
    applyBrandCssVariables(color);
  }, [data?.primaryColor]);

  return <>{children}</>;
}
