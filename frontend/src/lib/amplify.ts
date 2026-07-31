import "aws-amplify/auth/enable-oauth-listener";
import { Amplify } from "aws-amplify";
import { isAuthConfigured } from "@/lib/auth-session";

function oauthRedirectUrls(): { signIn: string[]; signOut: string[] } {
  if (typeof window === "undefined") {
    return { signIn: [], signOut: [] };
  }
  const origin = window.location.origin;
  return {
    signIn: [`${origin}/api/auth/callback/cognito`],
    signOut: [origin],
  };
}

export function isGoogleAuthConfigured(): boolean {
  return (
    isAuthConfigured() &&
    Boolean(process.env.NEXT_PUBLIC_COGNITO_DOMAIN?.trim()) &&
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"
  );
}

export function configureAmplify() {
  if (!isAuthConfigured()) return;

  const oauth = isGoogleAuthConfigured()
    ? {
        domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!,
        scopes: ["email", "openid", "profile"],
        redirectSignIn: oauthRedirectUrls().signIn,
        redirectSignOut: oauthRedirectUrls().signOut,
        responseType: "code" as const,
      }
    : undefined;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT!,
        loginWith: {
          email: true,
          ...(oauth ? { oauth } : {}),
        },
      },
    },
  });
}
