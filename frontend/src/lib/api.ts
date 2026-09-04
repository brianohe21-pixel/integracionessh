import { getIdToken } from "@/lib/auth-session";
import { localizeFlowError } from "@/lib/integration-errors";
import { translate } from "@/i18n/standalone";

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const TENANT_CONTEXT_KEY = "x-tenant-context";

export function getTenantContext(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TENANT_CONTEXT_KEY);
}

export function setTenantContext(tenantId: string | null): void {
  if (typeof window === "undefined") return;
  if (!tenantId) {
    localStorage.removeItem(TENANT_CONTEXT_KEY);
    return;
  }
  localStorage.setItem(TENANT_CONTEXT_KEY, tenantId);
}

function assertApiBaseUrl(): void {
  if (!BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not set. Add your API Gateway URL to .env.local.");
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = await getIdToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function getTenantContextHeader(): Record<string, string> {
  const tenantId = getTenantContext();
  if (!tenantId) return {};
  return { "X-Tenant-Context": tenantId };
}

function getPortalHostHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const host = window.location.hostname.trim().toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1") return {};
  return { "X-Portal-Host": host };
}

function localizeRequestError(message: string, path: string): string {
  if (!/\/flows(?:\/|$)/.test(path)) return message;
  return localizeFlowError(message, translate);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  assertApiBaseUrl();
  const authHeader = await getAuthHeader();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...getTenantContextHeader(),
        ...getPortalHostHeader(),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      `Network error calling ${BASE_URL}${path}. Check API URL, CORS, and that the route is deployed.`
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    const record = error as { error?: string; errors?: Record<string, unknown> };
    if (record.error) {
      throw new Error(localizeRequestError(record.error, path));
    }
    if (record.errors && typeof record.errors === "object") {
      const parts: string[] = [];
      for (const [field, messages] of Object.entries(record.errors)) {
        const list = Array.isArray(messages) ? messages : [messages];
        for (const item of list) {
          if (typeof item === "string" && item) {
            parts.push(field === "base" ? item : `${field}: ${item}`);
          }
        }
      }
      if (parts.length > 0) {
        throw new Error(localizeRequestError(parts.join("; "), path));
      }
    }
    throw new Error(`HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),

  delete: <T = void>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),

  async download(path: string, filename: string): Promise<void> {
    assertApiBaseUrl();
    const authHeader = await getAuthHeader();
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { ...authHeader, ...getTenantContextHeader(), ...getPortalHostHeader() },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error((error as { error: string }).error ?? `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },

  async getPublic<T>(path: string): Promise<T> {
    assertApiBaseUrl();
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error((error as { error: string }).error ?? `HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  },
};
