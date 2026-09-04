import {
  isAccountOutboundBlocked,
  isChannelOutboundBlocked,
} from "./enforcement.js";
import type { WhatsAppChannel, WhatsAppMessagingEnforcement } from "../../types/index.js";

describe("enforcement helpers", () => {
  it("detects blocked channel", () => {
    const channel = {
      messagingEnforcement: { blocked: true, source: "meta_auto" },
    } as WhatsAppChannel;
    expect(isChannelOutboundBlocked(channel)).toBe(true);
  });

  it("allows channel without enforcement", () => {
    expect(isChannelOutboundBlocked({} as WhatsAppChannel)).toBe(false);
  });

  it("detects blocked account", () => {
    const account = {
      messagingEnforcement: { blocked: true, source: "meta_auto" },
    } as { messagingEnforcement?: WhatsAppMessagingEnforcement };
    expect(isAccountOutboundBlocked(account)).toBe(true);
  });
});
