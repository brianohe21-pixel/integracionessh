const DEFAULT_BASE_URL = "https://api.mailrelay.com/v2";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;

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
  baseUrl?: string;
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

function responseMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    const message = value.message ?? value.error;
    if (typeof message === "string" && message) return message;
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
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetcher = options.fetcher ?? fetch;
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
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
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
          headers: { Accept: "application/json", Authorization: `Bearer ${this.apiKey}` },
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
