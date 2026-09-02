import {
  applyPlatformEmailTemplate,
  isPlatformEmailSender,
  resolvePlatformFromAddress,
  wrapPlatformEmailHtml,
} from "./platform-template.js";

describe("platform email template", () => {
  const originalSesFromEmail = process.env.SES_FROM_EMAIL;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
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

  it("detects platform sender from SES_FROM_EMAIL", () => {
    process.env.SES_FROM_EMAIL = "ops@integracionessh.lat";
    expect(isPlatformEmailSender("ops@integracionessh.lat")).toBe(true);
    expect(isPlatformEmailSender("no-reply@integracionessh.lat")).toBe(true);
    expect(isPlatformEmailSender("tenant@cliente.com")).toBe(false);
  });

  it("formats platform from address with brand name", () => {
    process.env.SES_FROM_EMAIL = "ops@integracionessh.lat";
    expect(resolvePlatformFromAddress("ops@integracionessh.lat")).toBe(
      '"Integraciones SSH" <ops@integracionessh.lat>'
    );
  });

  it("wraps html content with branded layout", () => {
    process.env.FRONTEND_URL = "https://app.integracionessh.lat";
    const html = wrapPlatformEmailHtml("<p>Hola</p>");
    expect(html).toContain("Integraciones SSH");
    expect(html).toContain("https://app.integracionessh.lat");
    expect(html).toContain("ops@integracionessh.lat");
    expect(html).toContain('alt="Integraciones SSH"');
    expect(html).toContain("cid:platform-logo");
    expect(html).toContain("cid:platform-social-facebook");
    expect(html).toContain('bgcolor="#08090b"');
    expect(html).not.toContain("data:image");
    expect(html).toContain('alt="Facebook"');
    expect(html).toContain('alt="Instagram"');
    expect(html).toContain('alt="TikTok"');
    expect(html).not.toContain(">Facebook</a>");
    expect(html).toContain("https://www.facebook.com/integracionessh");
    expect(html).toContain("https://www.instagram.com/integracionessh");
    expect(html).toContain("https://www.tiktok.com/@integracionessh");
    expect(html).toContain("<p>Hola</p>");
  });

  it("builds html from plain text and appends text footer", () => {
    process.env.SES_FROM_EMAIL = "ops@integracionessh.lat";
    const result = applyPlatformEmailTemplate({
      text: "Hola Ana,\n\nTu cuenta esta lista.",
    });

    expect(result.html).toContain("Integraciones SSH");
    expect(result.html).toContain("Tu cuenta esta lista.");
    expect(result.text).toContain("Este es un correo automatico");
    expect(result.text).toContain("ops@integracionessh.lat");
    expect(result.text).toContain("Facebook: https://www.facebook.com/integracionessh");
    expect(result.text).toContain("Instagram: https://www.instagram.com/integracionessh");
    expect(result.text).toContain("TikTok: https://www.tiktok.com/@integracionessh");
  });
});
