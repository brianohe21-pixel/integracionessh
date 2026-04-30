import type { APIGatewayRequestAuthorizerEventV2, APIGatewaySimpleAuthorizerWithContextResult } from "aws-lambda";

export async function handler(
  event: APIGatewayRequestAuthorizerEventV2
): Promise<APIGatewaySimpleAuthorizerWithContextResult<{ tenantId: string; userId: string; role: string }>> {
  const token = event.headers?.authorization?.replace("Bearer ", "");

  if (!token) {
    return { isAuthorized: false, context: { tenantId: "", userId: "", role: "" } };
  }

  try {
    const [, payloadBase64] = token.split(".");
    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8")
    ) as Record<string, string>;

    const tenantId = payload["custom:tenantId"] ?? "";
    const userId = payload["sub"] ?? "";
    const role = payload["custom:role"] ?? "member";

    if (!tenantId || !userId) {
      return { isAuthorized: false, context: { tenantId: "", userId: "", role: "" } };
    }

    return {
      isAuthorized: true,
      context: { tenantId, userId, role },
    };
  } catch {
    return { isAuthorized: false, context: { tenantId: "", userId: "", role: "" } };
  }
}
