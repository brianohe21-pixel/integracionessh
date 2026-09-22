jest.mock("./client.js", () => ({
  sendEmail: jest.fn(),
  parseEmailList: (value?: string) =>
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [],
}));

import { sendEmail } from "./client.js";
import { notifySupportTeamOfNewTicket } from "./support-ticket-notify.js";

const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe("notifySupportTeamOfNewTicket", () => {
  const originalSupportEmails = process.env.SUPPORT_NOTIFICATION_EMAILS;
  const originalPlatformSupport = process.env.PLATFORM_EMAIL_SUPPORT;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    jest.clearAllMocks();
    if (originalSupportEmails === undefined) {
      delete process.env.SUPPORT_NOTIFICATION_EMAILS;
    } else {
      process.env.SUPPORT_NOTIFICATION_EMAILS = originalSupportEmails;
    }
    if (originalPlatformSupport === undefined) {
      delete process.env.PLATFORM_EMAIL_SUPPORT;
    } else {
      process.env.PLATFORM_EMAIL_SUPPORT = originalPlatformSupport;
    }
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it("sends notification to info@integracionessh.lat by default", async () => {
    process.env.FRONTEND_URL = "https://app.integracionessh.lat";
    mockedSendEmail.mockResolvedValue({ messageId: "msg-1" });

    await notifySupportTeamOfNewTicket({
      ticketId: "ticket-1",
      tenantId: "tenant-1",
      createdBy: "user-1",
      email: "cliente@example.com",
      category: "technical",
      subject: "Error al conectar WhatsApp",
      message: "No puedo vincular mi número de WhatsApp Business.",
      status: "open",
      createdAt: "2026-03-21T12:00:00.000Z",
      updatedAt: "2026-03-21T12:00:00.000Z",
    });

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["info@integracionessh.lat"],
        subject: "[Soporte] Error al conectar WhatsApp",
      })
    );
    expect(mockedSendEmail.mock.calls[0]?.[0].text).toContain("cliente@example.com");
    expect(mockedSendEmail.mock.calls[0]?.[0].text).toContain(
      "https://app.integracionessh.lat/admin/support"
    );
  });

  it("uses SUPPORT_NOTIFICATION_EMAILS when configured", async () => {
    process.env.SUPPORT_NOTIFICATION_EMAILS = "soporte@example.com";
    mockedSendEmail.mockResolvedValue({ messageId: "msg-2" });

    await notifySupportTeamOfNewTicket({
      ticketId: "ticket-2",
      tenantId: "tenant-2",
      createdBy: "user-2",
      email: "user@example.com",
      category: "billing",
      subject: "Consulta de facturación",
      message: "Necesito ayuda con mi plan actual.",
      status: "open",
      createdAt: "2026-03-21T12:00:00.000Z",
      updatedAt: "2026-03-21T12:00:00.000Z",
    });

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["soporte@example.com"],
      })
    );
  });
});
