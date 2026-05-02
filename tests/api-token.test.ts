import { describe, it, expect } from "vitest";
import { tokenHasScope } from "../src/lib/api-token";

/**
 * API token scope-matching tests. Token issuance + verification
 * round-trip is covered by the storage-backed dedup-race fixture
 * elsewhere; these tests cover the pure scope-matching logic.
 */
describe("tokenHasScope", () => {
  it("wildcard '*' grants every action", () => {
    expect(tokenHasScope(["*"], "read:projects")).toBe(true);
    expect(tokenHasScope(["*"], "write:rfis")).toBe(true);
    expect(tokenHasScope(["*"], "delete:everything")).toBe(true);
  });

  it("exact-match scopes grant their own action", () => {
    expect(tokenHasScope(["read:projects"], "read:projects")).toBe(true);
    expect(tokenHasScope(["write:rfis", "read:listings"], "write:rfis")).toBe(true);
  });

  it("exact-match scope does NOT grant unrelated actions", () => {
    expect(tokenHasScope(["read:projects"], "write:rfis")).toBe(false);
    expect(tokenHasScope(["read:projects"], "read:listings")).toBe(false);
  });

  it("read scope does not imply write scope", () => {
    expect(tokenHasScope(["read:rfis"], "write:rfis")).toBe(false);
  });

  it("empty scope list grants nothing", () => {
    expect(tokenHasScope([], "read:projects")).toBe(false);
  });
});
