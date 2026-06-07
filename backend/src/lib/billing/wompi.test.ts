import { createHash } from "crypto";
import {
  amountInCentsForPlan,
  buildIntegritySignature,
  parsePaymentReference,
  verifyWompiEvent,
  type WompiWebhookEvent,
} from "./wompi.js";
import {
  WOMPI_AMOUNT_ENTERPRISE_CENTS_DEFAULT,
  WOMPI_AMOUNT_PRO_CENTS_DEFAULT,
} from "./plan-config.js";

describe("wompi billing", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses default plan amounts when env is missing", () => {
    delete process.env.WOMPI_AMOUNT_PRO_CENTS;
    delete process.env.WOMPI_AMOUNT_ENTERPRISE_CENTS;

    expect(amountInCentsForPlan("pro")).toBe(WOMPI_AMOUNT_PRO_CENTS_DEFAULT);
    expect(amountInCentsForPlan("enterprise")).toBe(
      WOMPI_AMOUNT_ENTERPRISE_CENTS_DEFAULT
    );
  });

  it("builds integrity signature for checkout", () => {
    process.env.WOMPI_INTEGRITY_SECRET = "test_secret";
    const reference = "wompi|tenant-1|pro|abc123";
    const amount = 17_990_000;

    const signature = buildIntegritySignature(reference, amount);
    const expected = createHash("sha256")
      .update(`${reference}${amount}COPtest_secret`)
      .digest("hex");

    expect(signature).toBe(expected);
  });

  it("parses payment references", () => {
    expect(parsePaymentReference("wompi|tenant-1|pro|abc")).toEqual({
      tenantId: "tenant-1",
      plan: "pro",
    });
    expect(parsePaymentReference("invalid")).toBeNull();
  });

  it("verifies webhook checksum", () => {
    process.env.WOMPI_EVENTS_SECRET = "events_secret";

    const timestamp = 1_700_000_000;
    const event: WompiWebhookEvent = {
      event: "transaction.updated",
      environment: "test",
      data: {
        transaction: {
          id: "tx-1",
          status: "APPROVED",
          reference: "wompi|tenant-1|pro|abc",
        },
      },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.reference"],
        checksum: "",
      },
      timestamp,
      sent_at: new Date(timestamp * 1000).toISOString(),
    };

    const chain =
      "tx-1" +
      "APPROVED" +
      "wompi|tenant-1|pro|abc" +
      String(timestamp) +
      "events_secret";
    event.signature.checksum = createHash("sha256")
      .update(chain)
      .digest("hex")
      .toUpperCase();

    expect(verifyWompiEvent(event)).toBe(true);
  });
});
