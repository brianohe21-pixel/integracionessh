export function isDevelopEnvironment(): boolean {
  return process.env.NEXT_PUBLIC_ENV === "dev";
}

export function getDemoCredentials(): { email: string; password: string } | null {
  if (!isDevelopEnvironment()) return null;

  const email = process.env.NEXT_PUBLIC_DEMO_EMAIL?.trim() ?? "";
  const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD?.trim() ?? "";

  if (!email || !password) return null;
  return { email, password };
}

export function isDemoLoginEnabled(): boolean {
  return getDemoCredentials() !== null;
}
