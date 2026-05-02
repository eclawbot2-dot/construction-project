import { describe, it, expect } from "vitest";
import { generateTotpSecret, totpCurrent, totpVerify, totpProvisioningUri } from "../src/lib/totp";

describe("TOTP — RFC 6238", () => {
  const secret = generateTotpSecret();

  it("generated secret is base32 (length divisible by 8)", () => {
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThan(20);
  });

  it("current code is 6 digits", () => {
    const code = totpCurrent(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it("verifier accepts the current code", () => {
    const code = totpCurrent(secret);
    expect(totpVerify(secret, code)).toBe(true);
  });

  it("verifier rejects an obviously wrong code", () => {
    expect(totpVerify(secret, "000000")).toBe(false);
    expect(totpVerify(secret, "999999")).toBe(false);
  });

  it("verifier accepts the previous step (clock-skew tolerance)", () => {
    const now = Date.now();
    const prevStep = now - 30_000;
    const prevCode = totpCurrent(secret, prevStep);
    expect(totpVerify(secret, prevCode, now)).toBe(true);
  });

  it("verifier rejects codes outside the 1-step drift window", () => {
    const now = Date.now();
    const tooOld = totpCurrent(secret, now - 90_000);
    expect(totpVerify(secret, tooOld, now)).toBe(false);
  });

  it("provisioning URI is well-formed otpauth", () => {
    const uri = totpProvisioningUri({ secret, account: "user@example.com", issuer: "bcon" });
    expect(uri).toMatch(/^otpauth:\/\/totp\/bcon:user/);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});
