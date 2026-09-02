import { formatImapError } from "./client.js";

describe("formatImapError", () => {
  it("maps authentication failures to a clear message", () => {
    const result = formatImapError({
      message: "Command failed",
      authenticationFailed: true,
      response: "3 NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)",
      serverResponseCode: "AUTHENTICATIONFAILED",
    });

    expect(result.statusCode).toBe(400);
    expect(result.message).toContain("Invalid IMAP credentials");
  });

  it("extracts detail from IMAP NO responses", () => {
    const result = formatImapError({
      message: "Command failed",
      response: "3 NO [NONEXISTENT] Mailbox does not exist",
    });

    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Mailbox does not exist");
  });

  it("maps DNS failures", () => {
    const result = formatImapError({
      message: "getaddrinfo ENOTFOUND imap.example.com",
      code: "ENOTFOUND",
      hostname: "imap.example.com",
    });

    expect(result.statusCode).toBe(400);
    expect(result.message).toContain("imap.example.com");
  });
});
