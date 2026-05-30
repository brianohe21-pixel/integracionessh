import type { APIGatewayProxyResultV2 } from "aws-lambda";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export function ok<T>(data: T): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

export function created<T>(data: T): APIGatewayProxyResultV2 {
  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

export function noContent(): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    headers: CORS_HEADERS,
    body: "",
  };
}

export function badRequest(message: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function unauthorized(message = "Unauthorized"): APIGatewayProxyResultV2 {
  return {
    statusCode: 401,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function forbidden(message = "Forbidden"): APIGatewayProxyResultV2 {
  return {
    statusCode: 403,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function paymentRequired(
  message: string,
  code?: string
): APIGatewayProxyResultV2 {
  return {
    statusCode: 402,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message, code: code ?? "PAYMENT_REQUIRED" }),
  };
}

export function notFound(message = "Not found"): APIGatewayProxyResultV2 {
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function internalError(message = "Internal server error"): APIGatewayProxyResultV2 {
  return {
    statusCode: 500,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function badGateway(message: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 502,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export function handleError(error: unknown): APIGatewayProxyResultV2 {
  console.error("Handler error:", error);

  const err = error as Error & { statusCode?: number };

  if (err.statusCode === 400) return badRequest(err.message);
  if (err.statusCode === 402) {
    return paymentRequired(err.message, (err as Error & { code?: string }).code);
  }
  if (err.statusCode === 403) return forbidden(err.message);
  if (err.statusCode === 404) return notFound(err.message);
  if (err.statusCode === 502) return badGateway(err.message);

  return internalError();
}
