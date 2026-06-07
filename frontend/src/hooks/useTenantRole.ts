"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export type TenantRole = "member" | "advisor" | "admin" | "unknown";

export function useTenantRole() {
  const [role, setRole] = useState<TenantRole>("unknown");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAuthSession()
      .then((session) => {
        if (cancelled) return;
        if (!session.tokens?.idToken) {
          setRole("unknown");
          return;
        }
        const raw = session.tokens.idToken.payload?.["custom:role"];
        if (raw === "admin") setRole("admin");
        else if (raw === "advisor") setRole("advisor");
        else if (raw === "member") setRole("member");
        else setRole("member");
      })
      .catch(() => {
        if (!cancelled) setRole("unknown");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    role,
    loading,
    isMember: role === "member",
    isAdvisor: role === "advisor",
    isAdmin: role === "admin",
  };
}
