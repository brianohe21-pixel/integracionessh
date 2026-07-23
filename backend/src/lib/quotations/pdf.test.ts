import {
  buildQuotationNumber,
  computeQuotationLineItems,
  computeQuotationTotals,
  renderQuotationPdf,
} from "./pdf.js";

describe("computeQuotationLineItems", () => {
  it("computes line totals and normalizes quantity", () => {
    const items = computeQuotationLineItems([
      { description: "Servicio", quantity: 2, unitPriceInCents: 25000 },
      { description: "  ", quantity: 0, unitPriceInCents: 1000 },
    ]);

    expect(items[0]).toEqual({
      description: "Servicio",
      quantity: 2,
      unitPriceInCents: 25000,
      totalInCents: 50000,
    });
    expect(items[1]?.quantity).toBe(1);
  });
});

describe("computeQuotationTotals", () => {
  it("sums subtotal and total", () => {
    const items = computeQuotationLineItems([
      { description: "A", quantity: 1, unitPriceInCents: 1000 },
      { description: "B", quantity: 3, unitPriceInCents: 2000 },
    ]);
    expect(computeQuotationTotals(items)).toEqual({
      subtotalInCents: 7000,
      totalInCents: 7000,
    });
  });
});

describe("buildQuotationNumber", () => {
  it("includes date and short id", () => {
    const number = buildQuotationNumber("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    expect(number).toMatch(/^COT-\d{8}-[A-F0-9]{6}$/);
  });
});

describe("renderQuotationPdf", () => {
  it("returns a non-empty PDF buffer", async () => {
    const now = new Date().toISOString();
    const buffer = await renderQuotationPdf({
      quotation: {
        quotationId: "q-1",
        tenantId: "t-1",
        botId: "b-1",
        conversationId: "c-1",
        contactPhone: "573001234567",
        contactName: "Cliente",
        number: "COT-20260101-ABC123",
        items: [
          {
            description: "Producto",
            quantity: 1,
            unitPriceInCents: 50000,
            totalInCents: 50000,
          },
        ],
        subtotalInCents: 50000,
        totalInCents: 50000,
        currency: "COP",
        status: "sent",
        sentAt: now,
        createdAt: now,
        updatedAt: now,
      },
      branding: {
        brandName: "Mi Empresa",
        primaryColor: "#4f46e5",
      },
    });

    expect(buffer.byteLength).toBeGreaterThan(500);
    expect(Buffer.from(buffer).subarray(0, 4).toString()).toBe("%PDF");
  });
});
