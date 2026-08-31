import { describe, expect, it } from "@jest/globals";
import { buildOAuthUrl, generatePkcePair, GOOGLE_CALENDAR_SCOPES } from "./client.js";

describe("google-calendar client", () => {
  it("generates deterministic PKCE challenge from verifier", () => {
    const first = generatePkcePair();
    const second = generatePkcePair();
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
    expect(first.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("builds OAuth URL with calendar scopes and PKCE", () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://api.example.com/public/integrations/google-calendar/oauth/callback";

    const { codeChallenge } = generatePkcePair();
    const url = new URL(buildOAuthUrl("state-123", codeChallenge));

    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("scope")).toBe(GOOGLE_CALENDAR_SCOPES);
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("code_challenge")).toBe(codeChallenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });
});
