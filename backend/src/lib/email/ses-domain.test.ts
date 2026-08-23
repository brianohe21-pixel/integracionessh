import { describe, expect, it } from "vitest";
import {
  extractEmailDomain,
  formatEmailFromAddress,
  isEmailOnDomain,
  normalizeEmailDomain,
} from "./ses-domain.js";

describe("ses-domain", () => {
  it("normalizes domains", () => {
    expect(normalizeEmailDomain("https://Mail.Example.COM/")).toBe("mail.example.com");
  });

  it("extracts email domain", () => {
    expect(extractEmailDomain("Alerts@Example.com")).toBe("example.com");
  });

  it("matches sender to verified domain", () => {
    expect(isEmailOnDomain("noreply@mail.example.com", "example.com")).toBe(true);
    expect(isEmailOnDomain("noreply@other.com", "example.com")).toBe(false);
  });

  it("formats from address with display name", () => {
    expect(formatEmailFromAddress("noreply@example.com", "Vital Shield")).toBe(
      '"Vital Shield" <noreply@example.com>'
    );
  });
});
