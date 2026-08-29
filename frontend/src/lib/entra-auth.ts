"use client";

import { signInWithRedirect } from "aws-amplify/auth";

export async function signInWithMicrosoft(providerName: string): Promise<void> {
  const trimmed = providerName.trim();
  if (!trimmed) {
    throw new Error("Microsoft sign-in is not configured");
  }
  await signInWithRedirect({
    provider: { custom: trimmed },
  });
}
