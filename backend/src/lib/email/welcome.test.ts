jest.mock("./client.js", () => ({
  sendEmail: jest.fn(),
}));

import { sendEmail } from "./client.js";
import { sendWelcomeEmail } from "./welcome.js";

const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe("sendWelcomeEmail", () => {
  const originalSesFromEmail = process.env.SES_FROM_EMAIL;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalBrandName = process.env.PLATFORM_EMAIL_BRAND_NAME;

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
    if (originalBrandName === undefined) {
      delete process.env.PLATFORM_EMAIL_BRAND_NAME;
    } else {
      process.env.PLATFORM_EMAIL_BRAND_NAME = originalBrandName;
    }
  });

  it("sends welcome email inviting user to explore the platform", async () => {
    process.env.SES_FROM_EMAIL = "noreply@example.com";
    process.env.FRONTEND_URL = "https://app.example.com";

    const result = await sendWelcomeEmail({
      to: "user@example.com",
      userName: "María",
    });

    expect(result).toEqual({ sent: true });
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "¡Bienvenido a Integraciones SSH!",
        text: expect.stringContaining("https://app.example.com/dashboard"),
      })
    );

    const text = mockedSendEmail.mock.calls[0]?.[0]?.text ?? "";
    const html = mockedSendEmail.mock.calls[0]?.[0]?.html ?? "";

    expect(text).toContain("Hola María,");
    expect(text).toContain("explorar la plataforma");
    expect(text).toContain("• Conversaciones omnicanal:");
    expect(text).toContain("WhatsApp, Instagram, email, SMS");
    expect(text).toContain("https://app.example.com/onboarding");
    expect(text).toContain("https://app.example.com/docs/manual");
    expect(html).toContain("Explorar la plataforma");
    expect(html).toContain("background-color:#000000");
  });

  it("uses configured brand name in subject", async () => {
    process.env.SES_FROM_EMAIL = "noreply@example.com";
    process.env.PLATFORM_EMAIL_BRAND_NAME = "Mi Plataforma";

    await sendWelcomeEmail({
      to: "user@example.com",
      userName: "Carlos",
    });

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "¡Bienvenido a Mi Plataforma!",
      })
    );
  });

  it("returns false when SES is not configured", async () => {
    delete process.env.SES_FROM_EMAIL;

    const result = await sendWelcomeEmail({
      to: "user@example.com",
      userName: "María",
    });

    expect(result).toEqual({ sent: false, failureReason: "not_configured" });
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("returns recipient_not_verified when SES rejects unverified recipient", async () => {
    process.env.SES_FROM_EMAIL = "noreply@example.com";
    mockedSendEmail.mockRejectedValueOnce(
      new Error("Email address is not verified. The following identities failed the check in region US-EAST-1: user@example.com")
    );

    const result = await sendWelcomeEmail({
      to: "user@example.com",
      userName: "María",
    });

    expect(result).toEqual({ sent: false, failureReason: "recipient_not_verified" });
  });

  it("returns send_failed when SES send fails", async () => {
    process.env.SES_FROM_EMAIL = "noreply@example.com";
    mockedSendEmail.mockRejectedValueOnce(new Error("Throttled"));

    const result = await sendWelcomeEmail({
      to: "user@example.com",
      userName: "María",
    });

    expect(result).toEqual({ sent: false, failureReason: "send_failed" });
  });
});
