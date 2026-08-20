"use client";

import { Suspense, useEffect, useState } from "react";
import { useT } from "@/i18n/context";
import { DEFAULT_PRIMARY_COLOR, hexToRgba } from "@/lib/brand-colors";
import { api } from "@/lib/api";

type HostBranding = {
  brandName?: string;
  primaryColor?: string;
  logoUrl?: string;
};

function AuthPageFallback() {
  return (
    <div className="rounded-2xl border border-default bg-surface-elevated p-8 shadow-xl">
      <div className="mb-6 h-6 w-32 animate-pulse rounded bg-surface-muted" />
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-10 animate-pulse rounded-lg bg-surface-muted" />
        <div className="h-10 animate-pulse rounded-lg bg-accent-muted" />
      </div>
    </div>
  );
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [hostBranding, setHostBranding] = useState<HostBranding | null>(null);

  useEffect(() => {
    const fromCookie: HostBranding = {
      brandName: readCookie("wl-brand-name"),
      primaryColor: readCookie("wl-primary-color"),
      logoUrl: readCookie("wl-logo-url"),
    };
    if (fromCookie.brandName || fromCookie.primaryColor || fromCookie.logoUrl) {
      setHostBranding(fromCookie);
    }

    const host = window.location.host.split(":")[0];
    void api
      .getPublic<{
        found?: boolean;
        brandName?: string;
        primaryColor?: string;
        logoUrl?: string;
      }>(`/public/branding-by-host?host=${encodeURIComponent(host)}`)
      .then((data) => {
        if (data.found) {
          setHostBranding({
            brandName: data.brandName,
            primaryColor: data.primaryColor,
            logoUrl: data.logoUrl,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  const displayName = hostBranding?.brandName ?? t("common.appName");
  const primaryColor = hostBranding?.primaryColor ?? DEFAULT_PRIMARY_COLOR;
  const logoUrl = hostBranding?.logoUrl;

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-surface"
      style={{
        background: `radial-gradient(ellipse at top, ${hexToRgba(primaryColor, 0.18)}, transparent 55%), linear-gradient(to bottom, var(--surface), var(--canvas))`,
      }}
    >
      <div className="relative w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <div
            className="relative mb-4 inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            {logoUrl ? (
              <img
                key={logoUrl}
                src={logoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-primary">{displayName}</h1>
          <p className="mt-1 text-sm text-secondary">{t("common.appTagline")}</p>
        </div>
        <Suspense fallback={<AuthPageFallback />}>{children}</Suspense>
        <p className="mt-6 text-center text-xs text-muted">
          <a href="/docs/api" className="hover:text-secondary">
            {t("apiDocs.navLink")}
          </a>
          {" · "}
          <a href="/docs/manual" className="hover:text-secondary">
            {t("userManual.navLink")}
          </a>
          {" · "}
          <a href="/legal/terms" className="hover:text-secondary">
            {t("legal.footerTerms")}
          </a>
          {" · "}
          <a href="/legal/privacy" className="hover:text-secondary">
            {t("legal.footerPrivacy")}
          </a>
        </p>
      </div>
    </div>
  );
}
