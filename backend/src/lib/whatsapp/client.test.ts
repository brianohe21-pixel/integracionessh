import { throwGraphApiError } from "./client.js";

function expectGraphError(
  body: string,
  status: number,
  expectedStatusCode: number,
  expectedMessagePart: string
): void {
  try {
    throwGraphApiError(status, body);
    throw new Error("expected throwGraphApiError to throw");
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    expect(err.statusCode).toBe(expectedStatusCode);
    expect(err.message).toContain(expectedMessagePart);
  }
}

describe("throwGraphApiError", () => {
  it("maps call permission already granted to 400", () => {
    expectGraphError(
      JSON.stringify({
        error: {
          message: "(#138017) Unable to send call permission request",
          code: 138017,
          error_user_msg: "A permanent permission has already been approved by this consumer.",
        },
      }),
      400,
      400,
      "permanent permission has already been approved"
    );
  });

  it("maps missing call permission to 400", () => {
    expectGraphError(
      JSON.stringify({
        error: {
          message: "No approved call permission from the recipient",
          code: 138006,
          error_user_msg: "No approved call permission from the recipient",
        },
      }),
      401,
      400,
      "No approved call permission"
    );
  });

  it("maps template not found to 400", () => {
    expectGraphError(
      JSON.stringify({
        error: {
          message: "(#132001) Template name does not exist in the translation",
          code: 132001,
        },
      }),
      404,
      400,
      "Template name does not exist"
    );
  });

  it("keeps transient Meta errors as 502", () => {
    expectGraphError(
      JSON.stringify({
        error: {
          message: "An unexpected error has occurred. Please retry your request later.",
          code: 2,
          is_transient: true,
        },
      }),
      500,
      502,
      "unexpected error has occurred"
    );
  });
});
