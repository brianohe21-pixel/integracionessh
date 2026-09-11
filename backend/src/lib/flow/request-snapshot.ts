import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { FlowEventRequestSnapshot } from "../../types/index.js";

const SENSITIVE_HEADER_NAMES = new Set([
  "x-flow-secret",
  "authorization",
  "cookie",
  "set-cookie",
]);

function redactHeaderValue(name: string, value: string): string {
  if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase())) {
    return "[redacted]";
  }
  return value;
}

export function buildFlowHookRequestSnapshot(
  event: APIGatewayProxyEventV2,
  hookKey: string,
  rawBody: string
): FlowEventRequestSnapshot {
  const headers = Object.entries({
    ...(event.headers ?? {}),
  }).reduce<Record<string, string>>((acc, [name, value]) => {
    if (!value) return acc;
    acc[name] = redactHeaderValue(name, value);
    return acc;
  }, {});

  const queryEntries = Object.entries(event.queryStringParameters ?? {}).filter(
    ([, value]) => value != null && value !== ""
  );

  return {
    method: event.requestContext.http.method,
    path: event.rawPath ?? `/public/flow-hooks/${hookKey}`,
    headers,
    ...(queryEntries.length > 0
      ? { queryString: Object.fromEntries(queryEntries) as Record<string, string> }
      : {}),
    bodyRaw: rawBody,
    sourceIp: event.requestContext.http.sourceIp,
    userAgent: event.requestContext.http.userAgent,
  };
}
