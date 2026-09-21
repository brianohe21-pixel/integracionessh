import { describe, expect, it } from "@jest/globals";
import {
  generateOtpCode,
  generateOtpSalt,
  hashOtpCode,
  hashOtpDestination,
  normalizeOtpDestination,
  renderOtpMessage,
  verifyOtpCodeHash,
} from "./crypto.js";

describe("otp crypto", () => {
  it("generates numeric OTP codes with fixed length", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes and verifies OTP codes", () => {
    const salt = generateOtpSalt();
    const hash = hashOtpCode("123456", salt);
    expect(verifyOtpCodeHash("123456", salt, hash)).toBe(true);
    expect(verifyOtpCodeHash("654321", salt, hash)).toBe(false);
  });

  it("normalizes destinations and hashes per tenant", () => {
    expect(normalizeOtpDestination("+57 300 123 4567")).toBe("573001234567");
    const first = hashOtpDestination("tenant-1", "573001234567");
    const second = hashOtpDestination("tenant-1", "+573001234567");
    const otherTenant = hashOtpDestination("tenant-2", "573001234567");
    expect(first).toBe(second);
    expect(first).not.toBe(otherTenant);
  });

  it("renders OTP message templates", () => {
    expect(renderOtpMessage("Code: {{code}}", "123456")).toBe("Code: 123456");
  });
});
