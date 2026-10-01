import { createHmac } from "crypto";
import { beforeEach, describe, expect, it } from "@jest/globals";
import {
  parseShopDomain,
  verifyOAuthHmac,
  verifyWebhookHmac,
} from "./client.js";

describe("shopify client", () => {
  beforeEach(() => {
    process.env.SHOPIFY_API_KEY = "test-key";
    process.env.SHOPIFY_API_SECRET = "test-secret";
    process.env.SHOPIFY_REDIRECT_URI =
      "https://api.example.com/public/integrations/shopify/oauth/callback";
  });

  it("parses myshopify domains", () => {
    expect(parseShopDomain("https://My-Store.myshopify.com/")).toBe("my-store.myshopify.com");
  });

  it("rejects invalid shop domains", () => {
    expect(() => parseShopDomain("evil.com")).toThrow(/myshopify/);
  });

  it("verifies OAuth HMAC", () => {
    const query = {
      code: "abc",
      shop: "my-store.myshopify.com",
      state: "state-1",
      timestamp: "1710000000",
    };
    const message = Object.keys(query)
      .sort()
      .map((key) => `${key}=${query[key as keyof typeof query]}`)
      .join("&");
    const hmac = createHmac("sha256", "test-secret").update(message).digest("hex");
    expect(verifyOAuthHmac({ ...query, hmac })).toBe(true);
    expect(verifyOAuthHmac({ ...query, hmac: "deadbeef" })).toBe(false);
  });

  it("verifies webhook HMAC", () => {
    const body = '{"id":1}';
    const hmac = createHmac("sha256", "test-secret").update(body, "utf8").digest("base64");
    expect(verifyWebhookHmac(body, hmac)).toBe(true);
    expect(verifyWebhookHmac(body, "nope")).toBe(false);
  });
});
