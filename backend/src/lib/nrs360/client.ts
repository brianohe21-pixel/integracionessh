import type { Nrs360Credentials } from "../../types/index.js";
import { normalizeNrs360BaseUrl } from "./secrets.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;

export class Nrs360ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "Nrs360ApiError";
  }
}

export interface Nrs360ClientOptions {
  username: string;
  apiPassword: string;
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetcher?: typeof fetch;
}

export interface Nrs360Page<T> {
  items: T[];
  page: number;
  perPage: number;
  totalPages?: number;
  hasMore: boolean;
}

export interface Nrs360MailingResult {
  campaignId?: number;
  sendingId?: number;
  messageIds: string[];
  raw: Record<string, unknown>;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function responseMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    const error = value.error;
    if (error && typeof error === "object" && !Array.isArray(error)) {
      const description = (error as Record<string, unknown>).description;
      if (typeof description === "string" && description) return stripHtml(description);
    }
    const message = value.message ?? value.description;
    if (typeof message === "string" && message) return stripHtml(message);
  }
  return `360nrs request failed with status ${status}`;
}

function retryDelay(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5_000);
  return Math.min(250 * 2 ** attempt, 2_000);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extractDataArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  const data = record.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = asRecord(data).data;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

function extractDataObject(payload: unknown): Record<string, unknown> {
  const record = asRecord(payload);
  const data = record.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return record;
}

export function createNrs360Client(
  credentials: Nrs360Credentials,
  options: Omit<Nrs360ClientOptions, "username" | "apiPassword" | "baseUrl"> = {}
): Nrs360Client {
  return new Nrs360Client({
    ...options,
    username: credentials.username,
    apiPassword: credentials.apiPassword,
    baseUrl: normalizeNrs360BaseUrl(credentials.baseUrl),
  });
}

export function buildNrs360AuthorizationHeader(username: string, apiPassword: string): string {
  return `Basic ${Buffer.from(`${username}:${apiPassword}`).toString("base64")}`;
}

export function formatNrs360ScheduleDate(isoOrLocal: string): string {
  const date = new Date(isoOrLocal);
  if (Number.isNaN(date.getTime())) {
    throw new Nrs360ApiError("Invalid schedule date", 400);
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  );
}

export class Nrs360Client {
  private readonly authorization: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetcher: typeof fetch;

  constructor(options: Nrs360ClientOptions) {
    this.authorization = buildNrs360AuthorizationHeader(options.username, options.apiPassword);
    this.baseUrl = normalizeNrs360BaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetcher = options.fetcher ?? fetch;
  }

  private apiUrl(path: string): URL {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const apiPath = normalized.startsWith("/api/rest")
      ? normalized
      : `/api/rest${normalized}`;
    return new URL(`${this.baseUrl}${apiPath}`);
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: { query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {}
  ): Promise<T> {
    const url = this.apiUrl(path);
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
            Authorization: this.authorization,
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

        if (response.ok || response.status === 202 || response.status === 207) {
          return payload as T;
        }

        if ((response.status === 429 || response.status >= 500) && attempt < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelay(attempt, response.headers.get("retry-after")))
          );
          continue;
        }

        throw new Nrs360ApiError(responseMessage(payload, response.status), response.status, payload);
      } catch (error) {
        if (error instanceof Nrs360ApiError) throw error;
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt, null)));
          continue;
        }
        if (error instanceof Error && error.name === "AbortError") {
          throw new Nrs360ApiError("360nrs request timed out", 504);
        }
        throw new Nrs360ApiError(
          error instanceof Error ? error.message : "360nrs request failed",
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
  ): Promise<Nrs360Page<T>> {
    const page = Number(query.page ?? 1);
    const perPage = Number(query.limit ?? query.per_page ?? 100);
    const payload = await this.request("GET", path, {
      query: { ...query, page, limit: perPage },
    });
    const items = extractDataArray(payload) as T[];
    const meta = asRecord(asRecord(payload).meta);
    const pagination = asRecord(meta.pagination);
    const totalPages = Number(pagination.total_pages);
    return {
      items,
      page,
      perPage,
      ...(Number.isFinite(totalPages) ? { totalPages } : {}),
      hasMore: Number.isFinite(totalPages) ? page < totalPages : items.length === perPage,
    };
  }

  async all<T>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    do {
      const result = await this.page<T>(path, { ...query, page, limit: query.limit ?? 100 });
      items.push(...result.items);
      if (!result.hasMore) break;
      page++;
    } while (page <= 1000);
    return items;
  }

  ping(): Promise<Record<string, unknown>> {
    return this.request("GET", "/account").then((payload) => extractDataObject(payload));
  }

  listGroups(): Promise<Array<{ id: number; name: string; [key: string]: unknown }>> {
    return this.all("/groups");
  }

  async findContactByEmail(email: string): Promise<Record<string, unknown> | null> {
    const page = await this.page<Record<string, unknown>>("/contacts", {
      email: email.trim().toLowerCase(),
      include: "groups",
      limit: 1,
    });
    return page.items[0] ?? null;
  }

  createContact(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("POST", "/contacts", { body: payload }).then(extractDataObject);
  }

  updateContact(id: number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("PUT", `/contacts/${id}`, { body: payload }).then(extractDataObject);
  }

  async syncContact(payload: {
    email: string;
    name?: string;
    groupsIds: number[];
  }): Promise<Record<string, unknown>> {
    const email = payload.email.trim().toLowerCase();
    const body: Record<string, unknown> = {
      email,
      groupsIds: payload.groupsIds,
      ...(payload.name ? { name: payload.name } : {}),
    };
    const existing = await this.findContactByEmail(email);
    if (existing && typeof existing.id === "number") {
      return this.updateContact(existing.id, body);
    }
    return this.createContact(body);
  }

  async listGroupEmails(groupIds: number[]): Promise<string[]> {
    const wanted = new Set(groupIds.filter((id) => Number.isInteger(id) && id > 0));
    if (wanted.size === 0) return [];
    const emails = new Set<string>();
    let page = 1;
    do {
      const result = await this.page<Record<string, unknown>>("/contacts", {
        page,
        limit: 100,
        include: "groups",
      });
      for (const contact of result.items) {
        const email = typeof contact.email === "string" ? contact.email.trim().toLowerCase() : "";
        if (!email) continue;
        const groups = extractDataArray(asRecord(contact.groups));
        const ids = groups
          .map((group) => Number(asRecord(group).id))
          .filter((id) => Number.isInteger(id) && id > 0);
        if (ids.some((id) => wanted.has(id))) emails.add(email);
      }
      if (!result.hasMore) break;
      page++;
    } while (page <= 1000);
    return [...emails];
  }

  async sendMailing(payload: {
    to: string[];
    fromEmail: string;
    fromName?: string;
    replyTo: string;
    subject: string;
    body: string;
    campaignName?: string;
    scheduleDate?: string;
    trackOpens?: boolean;
    trackClicks?: boolean;
  }): Promise<Nrs360MailingResult> {
    const recipients = [...new Set(payload.to.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    if (recipients.length === 0) {
      throw new Nrs360ApiError("No valid recipients", 400);
    }
    const response = await this.request<Record<string, unknown>>("POST", "/mailing", {
      body: {
        to: recipients,
        fromEmail: payload.fromEmail,
        replyTo: payload.replyTo,
        subject: payload.subject,
        body: payload.body,
        ...(payload.fromName ? { fromName: payload.fromName } : {}),
        ...(payload.campaignName ? { campaignName: payload.campaignName } : {}),
        ...(payload.scheduleDate ? { scheduleDate: payload.scheduleDate } : {}),
        ...(payload.trackOpens !== undefined ? { trackOpens: payload.trackOpens } : {}),
        ...(payload.trackClicks !== undefined ? { trackClicks: payload.trackClicks } : {}),
      },
    });
    const result = Array.isArray(response.result) ? response.result : [];
    const messageIds = result
      .map((item) => {
        const row = asRecord(item);
        return typeof row.id === "string" ? row.id : "";
      })
      .filter(Boolean);
    return {
      ...(typeof response.campaignId === "number" ? { campaignId: response.campaignId } : {}),
      ...(typeof response.sendingId === "number" ? { sendingId: response.sendingId } : {}),
      messageIds,
      raw: response,
    };
  }

  listMailingCampaigns(): Promise<Record<string, unknown>[]> {
    return this.all("/campaigns", { channel: "mailing" });
  }

  listV2Templates(): Promise<Record<string, unknown>[]> {
    return this.all("/v2/templates");
  }

  getV2Template(id: number): Promise<Record<string, unknown>> {
    return this.request("GET", `/v2/templates/${id}`).then(extractDataObject);
  }

  async listV2TemplatesWithHtml(): Promise<Record<string, unknown>[]> {
    const summaries = await this.listV2Templates();
    return Promise.all(
      summaries.map(async (summary) => {
        const id = Number(summary.id);
        if (!Number.isInteger(id) || id <= 0) return summary;
        try {
          return await this.getV2Template(id);
        } catch {
          return summary;
        }
      })
    );
  }

  createV2Template(payload: { name: string; html: string }): Promise<Record<string, unknown>> {
    return this.request("POST", "/v2/templates", {
      body: { name: payload.name, html: payload.html },
    }).then(extractDataObject);
  }

  updateV2Template(
    id: number,
    payload: { name: string; html: string }
  ): Promise<Record<string, unknown>> {
    return this.request("PUT", `/v2/templates/${id}`, {
      body: { name: payload.name, html: payload.html },
    }).then(extractDataObject);
  }

  deleteV2Template(id: number): Promise<void> {
    return this.request("DELETE", `/v2/templates/${id}`).then(() => undefined);
  }
}
