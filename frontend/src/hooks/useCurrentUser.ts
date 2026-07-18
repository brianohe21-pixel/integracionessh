"use client";

import { useEffect, useState } from "react";
import { fetchAuthSession, fetchUserAttributes } from "aws-amplify/auth";

export type CurrentUser = {
  email: string;
  name: string;
};

function buildDisplayName(attrs: Record<string, string | undefined>, email: string): string {
  const fullName = attrs.name?.trim();
  if (fullName) return fullName;

  const given = attrs.given_name?.trim();
  const family = attrs.family_name?.trim();
  if (given || family) return [given, family].filter(Boolean).join(" ");

  const preferred = attrs.preferred_username?.trim();
  if (preferred && preferred !== email) return preferred;

  const username = attrs["cognito:username"]?.trim();
  if (username && !username.includes("@")) return username;

  if (email.includes("@")) return email.split("@")[0];

  return email || username || "";
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const session = await fetchAuthSession();
        if (cancelled) return;

        if (!session.tokens?.idToken) {
          setUser(null);
          return;
        }

        const payload = session.tokens.idToken.payload;
        const tokenEmail = String(payload.email ?? "");
        const tokenName = String(
          payload.name ?? payload.given_name ?? payload["cognito:username"] ?? ""
        ).trim();

        try {
          const attributes = await fetchUserAttributes();
          if (cancelled) return;

          const email = attributes.email ?? tokenEmail;
          const attrs: Record<string, string | undefined> = {
            name: attributes.name ?? tokenName,
            given_name: attributes.given_name,
            family_name: attributes.family_name,
            preferred_username: attributes.preferred_username,
            "cognito:username": attributes.preferred_username,
          };
          const name = buildDisplayName(attrs, email);
          setUser({ email, name: name || email });
        } catch {
          const email = tokenEmail;
          const name = tokenName || (email.includes("@") ? email.split("@")[0] : email);
          setUser(email || name ? { email, name: name || email } : null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
}
