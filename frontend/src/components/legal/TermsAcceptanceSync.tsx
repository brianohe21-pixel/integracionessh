"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

const PENDING_KEY = "pending-terms-accept";

export function TermsAcceptanceSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(PENDING_KEY) !== "1") return;

    api
      .post("/tenants/me/accept-terms", {})
      .then(() => localStorage.removeItem(PENDING_KEY))
      .catch(() => {});
  }, []);

  return null;
}

export function markPendingTermsAcceptance() {
  if (typeof window !== "undefined") {
    localStorage.setItem(PENDING_KEY, "1");
  }
}
