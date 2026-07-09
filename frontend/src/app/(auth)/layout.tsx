"use client";

import { Suspense } from "react";
import { useT } from "@/i18n/context";
import { useTenantBranding } from "@/hooks/useTenantBranding";
import { hexToRgba } from "@/lib/brand-colors";

function AuthPageFallback() {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="space-y-4">
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-10 bg-indigo-100 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { data: branding } = useTenantBranding();
  const displayName = branding?.brandName ?? t("common.appName");
  const primaryColor = branding?.primaryColor ?? "#4f46e5";

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: `linear-gradient(to bottom right, ${hexToRgba(primaryColor, 0.08)}, #ffffff, ${hexToRgba(primaryColor, 0.05)})`,
      }}
    >
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 shadow-lg overflow-hidden"
            style={{ backgroundColor: primaryColor }}
          >
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("common.appTagline")}</p>
        </div>
        <Suspense fallback={<AuthPageFallback />}>{children}</Suspense>
        <p className="text-center text-xs text-gray-400 mt-6">
          <a href="/docs/api" className="hover:text-gray-600">
            {t("apiDocs.navLink")}
          </a>
          {" · "}
          <a href="/legal/terms" className="hover:text-gray-600">
            {t("legal.footerTerms")}
          </a>
          {" · "}
          <a href="/legal/privacy" className="hover:text-gray-600">
            {t("legal.footerPrivacy")}
          </a>
        </p>
      </div>
    </div>
  );
}
