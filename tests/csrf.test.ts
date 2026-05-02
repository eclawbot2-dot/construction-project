import { describe, it, expect } from "vitest";
import { csrfDecide } from "../src/lib/csrf";

describe("csrfDecide", () => {
  it("allows when origin missing (some user-agents on same-origin)", () => {
    expect(csrfDecide(null, "bcon.jahdev.com")).toBe("allow");
  });

  it("allows when origin host matches request host", () => {
    // URL parsing strips default ports (:443 for https, :80 for http)
    // so the parsed host is just "bcon.jahdev.com" — must compare to
    // a Host header without the explicit default port too.
    expect(csrfDecide("https://bcon.jahdev.com", "bcon.jahdev.com")).toBe("allow");
    expect(csrfDecide("https://bcon.jahdev.com:8443", "bcon.jahdev.com:8443")).toBe("allow");
  });

  it("blocks when origin host differs from request host", () => {
    expect(csrfDecide("https://evil.example.com", "bcon.jahdev.com")).toBe("block");
  });

  it("blocks even when scheme matches but host differs", () => {
    expect(csrfDecide("https://bcon-staging.jahdev.com", "bcon.jahdev.com")).toBe("block");
  });

  it("returns bad for malformed origin header", () => {
    expect(csrfDecide("not-a-url", "bcon.jahdev.com")).toBe("bad");
  });

  it("returns bad when host header is missing but origin present", () => {
    expect(csrfDecide("https://bcon.jahdev.com", null)).toBe("bad");
  });

  it("port mismatch counts as cross-origin", () => {
    // SAML/IdP misconfigurations sometimes accidentally emit ports.
    // Strict host comparison treats these as different origins.
    expect(csrfDecide("https://bcon.jahdev.com:8443", "bcon.jahdev.com")).toBe("block");
  });
});
