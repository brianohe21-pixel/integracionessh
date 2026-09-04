import { handleIntegrationError } from "./integration-errors.js";
import type { APIGatewayProxyResultV2 } from "aws-lambda";

function parseBody(response: APIGatewayProxyResultV2): { error?: string } {
  if (typeof response === "string" || !("body" in response)) return {};
  return JSON.parse(response.body ?? "{}") as { error?: string };
}

describe("handleIntegrationError", () => {
  it("masks graph api failures with reference", () => {
    const response = handleIntegrationError(
      Object.assign(new Error("Failed to subscribe WABA to webhooks: graph error"), {
        statusCode: 502,
      }),
      "whatsapp"
    );

    expect(typeof response === "object" && "statusCode" in response ? response.statusCode : 0).toBe(502);
    const body = parseBody(response);
    expect(body.error).toMatch(/Reference: INT-/);
  });

  it("passes through actionable validation errors", () => {
    const response = handleIntegrationError(
      Object.assign(new Error("PIN must be exactly 6 digits"), { statusCode: 400 }),
      "whatsapp"
    );

    expect(typeof response === "object" && "statusCode" in response ? response.statusCode : 0).toBe(400);
    const body = parseBody(response);
    expect(body.error).toBe("PIN must be exactly 6 digits");
  });
});
