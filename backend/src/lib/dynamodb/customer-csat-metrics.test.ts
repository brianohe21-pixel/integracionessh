import type { Conversation } from "../../types/index.js";
import { buildCustomerCsatRollup } from "./customer-csat-metrics.js";

function conversation(
  overrides: Partial<Conversation> & Pick<Conversation, "conversationId">
): Conversation {
  const now = "2026-07-10T12:00:00.000Z";
  return {
    tenantId: "t1",
    botId: "b1",
    channel: "whatsapp",
    participantId: "573000000000",
    phoneNumber: "573000000000",
    status: "closed",
    workflowStatus: "resolved",
    messageCount: 1,
    lastMessageAt: now,
    createdAt: now,
    ...overrides,
  };
}

describe("customer csat metrics", () => {
  const range = { from: "2026-07-01", to: "2026-07-31" };

  it("aggregates csat scores by phone and ranks by average", () => {
    const metrics = buildCustomerCsatRollup(
      [
        conversation({
          conversationId: "c1",
          phoneNumber: "573111111111",
          contactName: "Alice",
          csatScore: 5,
          csatSubmittedAt: "2026-07-05T12:00:00.000Z",
        }),
        conversation({
          conversationId: "c2",
          phoneNumber: "573111111111",
          contactName: "Alice Updated",
          csatScore: 3,
          csatSubmittedAt: "2026-07-08T12:00:00.000Z",
        }),
        conversation({
          conversationId: "c3",
          phoneNumber: "573222222222",
          contactName: "Bob",
          csatScore: 4,
          csatSubmittedAt: "2026-07-06T12:00:00.000Z",
        }),
      ],
      { range }
    );

    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toMatchObject({
      contactPhone: "573111111111",
      contactName: "Alice Updated",
      averageCsat: 4,
      ratingCount: 2,
    });
    expect(metrics[1]).toMatchObject({
      contactPhone: "573222222222",
      contactName: "Bob",
      averageCsat: 4,
      ratingCount: 1,
    });
  });

  it("excludes conversations without csat and outside date range", () => {
    const metrics = buildCustomerCsatRollup(
      [
        conversation({
          conversationId: "c1",
          csatScore: 5,
          csatSubmittedAt: "2026-06-01T12:00:00.000Z",
        }),
        conversation({
          conversationId: "c2",
          csatSubmittedAt: "2026-07-05T12:00:00.000Z",
        }),
        conversation({
          conversationId: "c3",
          csatScore: 2,
          resolvedAt: "2026-07-07T12:00:00.000Z",
        }),
      ],
      { range }
    );

    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      contactPhone: "573000000000",
      averageCsat: 2,
      ratingCount: 1,
    });
  });

  it("returns all-time metrics when no range is provided", () => {
    const metrics = buildCustomerCsatRollup([
      conversation({
        conversationId: "c1",
        csatScore: 5,
        csatSubmittedAt: "2025-01-01T12:00:00.000Z",
      }),
      conversation({
        conversationId: "c2",
        phoneNumber: "573999999999",
        csatScore: 1,
        csatSubmittedAt: "2026-07-10T12:00:00.000Z",
      }),
    ]);

    expect(metrics).toHaveLength(2);
    expect(metrics[0]?.averageCsat).toBe(5);
    expect(metrics[1]?.averageCsat).toBe(1);
  });

  it("limits results to top customers", () => {
    const metrics = buildCustomerCsatRollup(
      Array.from({ length: 7 }, (_, index) =>
        conversation({
          conversationId: `c${index}`,
          phoneNumber: `57300000000${index}`,
          csatScore: 5 - index,
          csatSubmittedAt: "2026-07-10T12:00:00.000Z",
        })
      ),
      { range, limit: 5 }
    );

    expect(metrics).toHaveLength(5);
    expect(metrics[0]?.averageCsat).toBe(5);
    expect(metrics[4]?.averageCsat).toBe(1);
  });
});
