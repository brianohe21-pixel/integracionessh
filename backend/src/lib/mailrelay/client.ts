const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const AUTH_HEADER = "X-AUTH-TOKEN";

export class MailrelayApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "MailrelayApiError";
  }
}

export interface MailrelayClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetcher?: typeof fetch;
}

export interface MailrelayPage<T> {
  items: T[];
  totalPages?: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

export function normalizeMailrelayBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new MailrelayApiError("Mailrelay base URL is not configured", 400);
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);
  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname || pathname === "/") {
    url.pathname = "/api/v1";
  } else if (!pathname.endsWith("/api/v1")) {
    url.pathname = `${pathname}/api/v1`;
  }
  return url.toString().replace(/\/$/, "");
}

export function createMailrelayClient(
  credentials: Pick<MailrelayClientOptions, "apiKey" | "baseUrl">,
  options: Omit<MailrelayClientOptions, "apiKey" | "baseUrl"> = {}
): MailrelayClient {
  return new MailrelayClient({
    ...options,
    apiKey: credentials.apiKey,
    baseUrl: normalizeMailrelayBaseUrl(credentials.baseUrl),
  });
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function responseMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    const message = value.message ?? value.error;
    if (typeof message === "string" && message) return stripHtml(message);

    const errors = value.errors;
    if (errors && typeof errors === "object" && !Array.isArray(errors)) {
      const parts: string[] = [];
      for (const [field, messages] of Object.entries(errors as Record<string, unknown>)) {
        const list = Array.isArray(messages) ? messages : [messages];
        for (const item of list) {
          if (typeof item === "string" && item) {
            parts.push(field === "base" ? stripHtml(item) : `${field}: ${stripHtml(item)}`);
          }
        }
      }
      if (parts.length > 0) return parts.join("; ");
    }
  }
  return `Email provider request failed with status ${status}`;
}

function retryDelay(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5_000);
  return Math.min(250 * 2 ** attempt, 2_000);
}

export class MailrelayClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetcher: typeof fetch;

  constructor(options: MailrelayClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = normalizeMailrelayBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetcher = options.fetcher ?? fetch;
  }

  private authHeaders(contentType = false): Record<string, string> {
    return {
      Accept: "application/json",
      [AUTH_HEADER]: this.apiKey,
      ...(contentType ? { "Content-Type": "application/json" } : {}),
    };
  }

  async request<T>(
    method: string,
    path: string,
    options: { query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(url, {
          method,
          headers: this.authHeaders(options.body !== undefined),
          ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
          signal: controller.signal,
        });

        const text = await response.text();
        let payload: unknown;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = text;
          }
        }

        if (response.ok) return payload as T;

        if ((response.status === 429 || response.status >= 500) && attempt < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay(attempt, response.headers.get("retry-after")))
          );
          continue;
        }

        throw new MailrelayApiError(
          responseMessage(payload, response.status),
          response.status,
          payload
        );
      } catch (error) {
        if (error instanceof MailrelayApiError) throw error;
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt, null)));
          continue;
        }
        if (error instanceof Error && error.name === "AbortError") {
          throw new MailrelayApiError("Email provider request timed out", 504);
        }
        throw new MailrelayApiError(
          error instanceof Error ? error.message : "Email provider request failed",
          502
        );
      } finally {
        clearTimeout(timer);
      }
    }
  }

  async page<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {}
  ): Promise<MailrelayPage<T>> {
    const page = Number(query.page ?? 1);
    const perPage = Number(query.per_page ?? 100);
    const url = new URL(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries({ ...query, page, per_page: perPage })) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(url, {
          headers: this.authHeaders(),
          signal: controller.signal,
        });
        const text = await response.text();
        const payload = text ? (JSON.parse(text) as unknown) : [];
        if (!response.ok) {
          if ((response.status === 429 || response.status >= 500) && attempt < this.maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay(attempt, response.headers.get("retry-after")))
            );
            continue;
          }
          throw new MailrelayApiError(
            responseMessage(payload, response.status),
            response.status,
            payload
          );
        }
        const items = Array.isArray(payload)
          ? (payload as T[])
          : (((payload as Record<string, unknown>).data ?? []) as T[]);
        const totalHeader = response.headers.get("total") ?? response.headers.get("x-total");
        const totalPages = totalHeader ? Number(totalHeader) : undefined;
        return {
          items,
          ...(totalPages !== undefined && Number.isFinite(totalPages)
            ? { totalPages }
            : {}),
          page,
          perPage,
          hasMore:
            totalPages !== undefined ? page < totalPages : items.length === perPage,
        };
      } catch (error) {
        if (error instanceof MailrelayApiError) throw error;
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt, null)));
          continue;
        }
        throw new MailrelayApiError(
          error instanceof Error && error.name === "AbortError"
            ? "Email provider request timed out"
            : error instanceof Error
              ? error.message
              : "Email provider request failed",
          error instanceof Error && error.name === "AbortError" ? 504 : 502
        );
      } finally {
        clearTimeout(timer);
      }
    }
  }

  async all<T>(path: string, query: Record<string, string | number | boolean | undefined> = {}): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    do {
      const result = await this.page<T>(path, { ...query, page, per_page: query.per_page ?? 100 });
      items.push(...result.items);
      if (!result.hasMore) break;
      page++;
    } while (page <= 1000);
    return items;
  }

  ping(): Promise<unknown> {
    return this.request("GET", "/ping");
  }

  syncSubscriber(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("POST", "/subscribers/sync", { body: payload });
  }
}
