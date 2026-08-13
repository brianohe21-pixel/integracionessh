import type { APIGatewayProxyEventV2 } from "aws-lambda";

function headerValue(
  headers: Record<string, string | undefined> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && value) return value;
  }
  return undefined;
}

export function resolveApiBaseUrlFromEnv(): string {
  const raw =
    process.env.API_BASE_URL ?? process.env.API_PUBLIC_URL ?? process.env.PUBLIC_API_URL ?? "";
  return raw.trim().replace(/\/$/, "");
}

export function resolveApiBaseUrl(
  event?: Pick<APIGatewayProxyEventV2, "headers" | "requestContext">
): string {
  const fromEnv = resolveApiBaseUrlFromEnv();
  if (fromEnv) return fromEnv;
  if (!event) return "";

  const proto = headerValue(event.headers, "x-forwarded-proto") ?? "https";
  const host =
    headerValue(event.headers, "host") ??
    headerValue(event.headers, "x-forwarded-host") ??
    event.requestContext?.domainName;
  if (!host) return "";

  return `${proto}://${host}`.replace(/\/$/, "");
}
