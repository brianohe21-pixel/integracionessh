import { signOut } from "aws-amplify/auth";

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_USER_POOL_ID?.trim() &&
      process.env.NEXT_PUBLIC_USER_POOL_CLIENT?.trim()
  );
}

function isUserPoolNotConfiguredError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = "name" in err ? String((err as { name: string }).name) : "";
  const message = "message" in err ? String((err as { message: string }).message) : "";
  return (
    name === "AuthUserPoolException" ||
    message.includes("UserPool not configured")
  );
}

export function clearLocalAuthStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of Object.keys(localStorage)) {
    if (
      key.startsWith("CognitoIdentityServiceProvider.") ||
      key.includes("amplify") ||
      key.includes("aws-amplify")
    ) {
      localStorage.removeItem(key);
    }
  }
}

export async function signOutUser(): Promise<void> {
  if (!isAuthConfigured()) {
    clearLocalAuthStorage();
    return;
  }

  try {
    await signOut();
  } catch (err) {
    if (isUserPoolNotConfiguredError(err)) {
      clearLocalAuthStorage();
      return;
    }
    throw err;
  }
}
