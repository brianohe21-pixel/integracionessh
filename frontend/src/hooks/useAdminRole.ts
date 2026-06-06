"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export function useAdminRole() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAuthSession()
      .then((session) => {
        if (cancelled) return;
        const role = session.tokens?.idToken?.payload?.["custom:role"];
        setIsAdmin(role === "admin");
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { isAdmin, loading };
}
