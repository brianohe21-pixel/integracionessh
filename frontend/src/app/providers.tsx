"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { configureAmplify } from "@/lib/amplify";
import { I18nProvider } from "@/i18n/context";
import { HtmlLang } from "@/components/layout/HtmlLang";
import { TenantBrandingProvider } from "@/components/branding/TenantBrandingProvider";
import { BrandDocumentTitle } from "@/components/branding/BrandDocumentTitle";

if (typeof window !== "undefined") {
  configureAmplify();
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <I18nProvider>
      <HtmlLang />
      <QueryClientProvider client={queryClient}>
        <TenantBrandingProvider>
          <BrandDocumentTitle />
          {children}
        </TenantBrandingProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
