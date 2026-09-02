"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/context";
import { signInWithMicrosoft } from "@/lib/entra-auth";

function MicrosoftIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

type MicrosoftSignInButtonProps = {
  providerName: string;
  className?: string;
  onError?: (message: string) => void;
};

export function MicrosoftSignInButton({
  providerName,
  className,
  onError,
}: MicrosoftSignInButtonProps) {
  const t = useT();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await signInWithMicrosoft(providerName);
    } catch (err) {
      onError?.((err as Error).message ?? t("auth.microsoftError"));
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-lg border border-default bg-surface-elevated px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-surface",
        loading && "cursor-not-allowed opacity-60",
        className
      )}
    >
      <MicrosoftIcon />
      {loading ? t("auth.signingIn") : t("auth.continueWithMicrosoft")}
    </button>
  );
}
