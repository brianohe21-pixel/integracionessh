import {
  buildTenantPaymentReference,
  createPaymentCheckout,
  formatPaymentMessage,
  parseTenantPaymentReference,
} from "./checkout.js";

describe("payments checkout", () => {
  const creds = {
    publicKey: "pub_test",
    integritySecret: "integrity_test",
    eventsSecret: "events_test",
  };

  it("builds tenant payment reference", () => {
    const ref = buildTenantPaymentReference("tenant-1", "bot-1", "pay-1");
    expect(ref.startsWith("tpay|tenant-1|bot-1|pay-1|")).toBe(true);
    expect(parseTenantPaymentReference(ref)).toEqual({
      tenantId: "tenant-1",
      botId: "bot-1",
      paymentId: "pay-1",
    });
  });

  it("creates checkout url with injected credentials", () => {
    const result = createPaymentCheckout({
      creds,
      tenantId: "tenant-1",
      botId: "bot-1",
      amountInCents: 50_000,
      customerEmail: "test@example.com",
      successRedirectUrl: "https://app.example/payments/complete",
    });

    expect(result.checkoutUrl).toContain("pub_test");
    expect(result.checkoutUrl).toContain("amount-in-cents=50000");
    expect(result.reference).toContain("tpay|tenant-1|bot-1|");
  });

  it("formats payment message template", () => {
    const text = formatPaymentMessage(
      "Paga {{amount}} por {{description}}: {{url}}",
      "https://pay.test/link",
      50_000,
      "Consulta"
    );
    expect(text).toContain("https://pay.test/link");
    expect(text).toContain("Consulta");
  });
});
