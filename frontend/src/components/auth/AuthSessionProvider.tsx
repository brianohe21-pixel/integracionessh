"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useQueryClient } from "@tanstack/react-query";
import { setTenantContext } from "@/lib/api";
import { TENANT_BRANDING_QUERY_KEY } from "@/hooks/useTenantBranding";

type AuthSessionValue = {
  isAuthenticated: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearOnSignOut = useCallback(() => {
    setTenantContext(null);
    queryClient.removeQueries({ queryKey: ["reseller-subaccounts"] });
    queryClient.removeQueries({ queryKey: TENANT_BRANDING_QUERY_KEY });
    queryClient.removeQueries({ queryKey: ["tenants", "me"] });
  }, [queryClient]);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      setIsAuthenticated(Boolean(session.tokens?.idToken));
    } catch {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
        case "signInWithRedirect":
          setTenantContext(null);
          queryClient.removeQueries({ queryKey: ["reseller-subaccounts"] });
          void refresh();
          break;
        case "tokenRefresh":
          void refresh();
          break;
        case "signedOut":
        case "tokenRefresh_failure":
          clearOnSignOut();
          setIsAuthenticated(false);
          setLoading(false);
          break;
        default:
          break;
      }
    });

    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, clearOnSignOut, queryClient]);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  const value = useMemo(
    () => ({ isAuthenticated, loading, refresh }),
    [isAuthenticated, loading, refresh]
  );

  return (
    <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }
  return ctx;
}
