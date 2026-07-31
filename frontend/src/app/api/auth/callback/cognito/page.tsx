"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAuthSession } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { getPostLoginPath } from "@/lib/post-login-path";
import { useT } from "@/i18n/context";

function CognitoOAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const redirectTo = searchParams.get("redirect");

    async function completeSignIn() {
      try {
        const session = await fetchAuthSession();
        if (cancelled) return;
        if (session.tokens?.idToken) {
          router.replace(await getPostLoginPath(redirectTo));
        }
      } catch {
        if (!cancelled) {
          setError(t("auth.googleError"));
        }
      }
    }

    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") {
        void completeSignIn();
      }
      if (payload.event === "signInWithRedirect_failure") {
        if (!cancelled) {
          setError(t("auth.googleError"));
        }
      }
    });

    void completeSignIn();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router, searchParams, t]);

  if (error) {
    return (
      <div className="bg-surface-elevated rounded-2xl shadow-xl p-8 border border-subtle text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated rounded-2xl shadow-xl p-8 border border-subtle text-center">
      <p className="text-sm text-secondary">{t("auth.signingIn")}</p>
    </div>
  );
}

export default function CognitoOAuthCallbackPage() {
  const t = useT();

  return (
    <Suspense
      fallback={
        <div className="bg-surface-elevated rounded-2xl shadow-xl p-8 border border-subtle text-center">
          <p className="text-sm text-secondary">{t("auth.signingIn")}</p>
        </div>
      }
    >
      <CognitoOAuthCallbackContent />
    </Suspense>
  );
}
