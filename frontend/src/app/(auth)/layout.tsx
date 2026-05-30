"use client";

import { useT } from "@/i18n/context";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t("common.appName")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("common.appTagline")}</p>
        </div>
        {children}
        <p className="text-center text-xs text-gray-400 mt-6">
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
