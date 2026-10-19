import {
  countUnreadConversations,
  reconcileUnreadCounts,
  unreadCountsEqual,
} from "./counts";

describe("countUnreadConversations", () => {
  it("counts conversations instead of summing messages", () => {
    expect(
      countUnreadConversations({
        a: 5,
        b: 8,
        c: 0,
      })
    ).toBe(2);
  });

  it("returns zero for empty counts", () => {
    expect(countUnreadConversations({})).toBe(0);
  });
});

describe("reconcileUnreadCounts", () => {
  it("keeps message-based unread for known conversations", () => {
    const next = reconcileUnreadCounts(
      { a: 3, stale: 9 },
      [
        { conversationId: "a", workflowStatus: "open" },
        { conversationId: "b", workflowStatus: "open" },
      ],
      null,
      { pruneUnknown: true }
    );

    expect(next).toEqual({ a: 3 });
  });

  it("marks new conversations as unread", () => {
    const next = reconcileUnreadCounts(
      {},
      [{ conversationId: "new-1", workflowStatus: "new" }],
      null
    );

    expect(next).toEqual({ "new-1": 1 });
  });

  it("skips the active conversation when seeding new status", () => {
    const next = reconcileUnreadCounts(
      {},
      [{ conversationId: "active", workflowStatus: "new" }],
      "active"
    );

    expect(next).toEqual({});
  });

  it("does not prune unknown ids unless requested", () => {
    const next = reconcileUnreadCounts(
      { a: 1, ghost: 4 },
      [{ conversationId: "a", workflowStatus: "open" }],
      null
    );

    expect(next).toEqual({ a: 1, ghost: 4 });
  });
});

describe("unreadCountsEqual", () => {
  it("compares unread maps by key and value", () => {
    expect(unreadCountsEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(unreadCountsEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(unreadCountsEqual({ a: 1 }, { a: 1, b: 1 })).toBe(false);
  });
});
