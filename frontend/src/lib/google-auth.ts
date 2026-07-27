"use client";

import { signInWithRedirect } from "aws-amplify/auth";
import { isGoogleAuthConfigured } from "@/lib/amplify";

export async function signInWithGoogle(): Promise<void> {
  if (!isGoogleAuthConfigured()) {
    throw new Error("Google sign-in is not configured");
  }
  await signInWithRedirect({ provider: "Google" });
}
