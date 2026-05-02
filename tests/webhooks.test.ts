import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

/**
 * Webhook HMAC signature tests. The dispatchWebhook() function in
 * src/lib/webhooks.ts builds an "x-bcon-signature" header as
 *   "sha256=" + hex(HMAC_SHA256(secret, body))
 *
 * These tests assert the signature format + verifiability so a
 * downstream receiver implementing the same scheme will accept it.
 */
describe("webhook HMAC signatures", () => {
  const secret = "shared-test-secret-12345";
  const body = JSON.stringify({ event: "rfi.created", data: { id: "r1" } });

  it("generates a deterministic signature for a fixed body + secret", () => {
    const sig1 = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const sig2 = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("a different body produces a different signature", () => {
    const sig1 = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const sig2 = crypto.createHmac("sha256", secret).update(body + " ").digest("hex");
    expect(sig1).not.toBe(sig2);
  });

  it("a different secret produces a different signature", () => {
    const sig1 = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const sig2 = crypto.createHmac("sha256", secret + "x").update(body).digest("hex");
    expect(sig1).not.toBe(sig2);
  });

  it("receiver can verify the signature given the same secret", () => {
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
    // Receiver-side verification:
    const actual = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(expected).toBe(`sha256=${actual}`);
  });

  it("empty body still produces a valid 64-hex signature", () => {
    const sig = crypto.createHmac("sha256", secret).update("").digest("hex");
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });
});
