import type { PublicHostedForm } from "@/types";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

function assertApiBaseUrl(): void {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set");
  }
}

async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  assertApiBaseUrl();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((error as { error: string }).error ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const publicFormApi = {
  getForm: (publicKey: string) =>
    publicRequest<PublicHostedForm>(`/public/forms/${encodeURIComponent(publicKey)}`),

  submit: (publicKey: string, payload: Record<string, unknown>) =>
    publicRequest<{ submissionId: string; redirectUrl?: string }>(
      `/public/forms/${encodeURIComponent(publicKey)}/submit`,
      { method: "POST", body: JSON.stringify(payload) }
    ),
};
