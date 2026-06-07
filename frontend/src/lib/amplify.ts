import { Amplify } from "aws-amplify";
import { isAuthConfigured } from "@/lib/auth-session";

export function configureAmplify() {
  if (!isAuthConfigured()) return;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT!,
        loginWith: {
          email: true,
        },
      },
    },
  });
}
