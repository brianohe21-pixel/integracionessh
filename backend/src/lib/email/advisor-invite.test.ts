jest.mock("./client.js", () => ({
  sendEmail: jest.fn(),
}));

import { sendEmail } from "./client.js";
import { sendAdvisorInviteEmail } from "./advisor-invite.js";

const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe("sendAdvisorInviteEmail", () => {
  const originalSesFromEmail = process.env.SES_FROM_EMAIL;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalSesFromEmail === undefined) {
      delete process.env.SES_FROM_EMAIL;
    } else {
      process.env.SES_FROM_EMAIL = originalSesFromEmail;
    }
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it("sends invite email with tenant name and login instructions", async () => {
    process.env.SES_FROM_EMAIL = "noreply@example.com";
    process.env.FRONTEND_URL = "https://app.example.com";

    const sent = await sendAdvisorInviteEmail({
      to: "advisor@example.com",
      advisorName: "Ana",
      tenantName: "Acme Corp",
      temporaryPassword: "Aa1!temp-pass",
    });

    expect(sent).toEqual({ sent: true });
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["advisor@example.com"],
        subject: "Tu cuenta en Acme Corp",
        text: expect.stringContaining("https://app.example.com/login"),
      })
    );
    const text = mockedSendEmail.mock.calls[0]?.[0]?.text ?? "";
    expect(text).toContain("En tu primer inicio de sesión deberás cambiar la contraseña.");
    expect(text).toContain("Acme Corp te ha creado una cuenta de asesor");
  });

  it("returns false when SES is not configured", async () => {
    delete process.env.SES_FROM_EMAIL;

    const sent = await sendAdvisorInviteEmail({
      to: "advisor@example.com",
      advisorName: "Ana",
      tenantName: "Acme Corp",
      temporaryPassword: "Aa1!temp-pass",
    });

    expect(sent).toEqual({ sent: false, failureReason: "not_configured" });
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("returns recipient_not_verified when SES rejects unverified recipient", async () => {
    process.env.SES_FROM_EMAIL = "noreply@example.com";
    mockedSendEmail.mockRejectedValueOnce(
      new Error("Email address is not verified. The following identities failed the check in region US-EAST-1: advisor@example.com")
    );

    const sent = await sendAdvisorInviteEmail({
      to: "advisor@example.com",
      advisorName: "Ana",
      tenantName: "Acme Corp",
      temporaryPassword: "Aa1!temp-pass",
    });

    expect(sent).toEqual({ sent: false, failureReason: "recipient_not_verified" });
  });

  it("returns send_failed when SES send fails", async () => {
    process.env.SES_FROM_EMAIL = "noreply@example.com";
    mockedSendEmail.mockRejectedValueOnce(new Error("Throttled"));

    const sent = await sendAdvisorInviteEmail({
      to: "advisor@example.com",
      advisorName: "Ana",
      tenantName: "Acme Corp",
      temporaryPassword: "Aa1!temp-pass",
    });

    expect(sent).toEqual({ sent: false, failureReason: "send_failed" });
  });
});
