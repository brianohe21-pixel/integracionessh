import { fetchAuthSession, signOut } from "aws-amplify/auth";
import { setTenantContext } from "@/lib/api";

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_USER_POOL_ID?.trim() &&
      process.env.NEXT_PUBLIC_USER_POOL_CLIENT?.trim()
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function getIdToken(): Promise<string | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const session = await fetchAuthSession({
        forceRefresh: attempt > 0,
      });
      const token = session.tokens?.idToken?.toString();
      if (token) return token;
    } catch {
      // retry
    }
    if (attempt < 5) await sleep(80 * (attempt + 1));
  }
  return null;
}

export async function ensureAuthSession(): Promise<boolean> {
  return Boolean(await getIdToken());
}

export function clearLocalAuthStorage(): void {
  if (typeof window === "undefined") return;
  setTenantContext(null);
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
  setTenantContext(null);

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
