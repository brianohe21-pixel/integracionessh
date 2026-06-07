"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export function useAuthSession() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchAuthSession()
      .then((session) => {
        if (cancelled) return;
        setIsAuthenticated(Boolean(session.tokens?.idToken));
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { isAuthenticated, loading };
}
