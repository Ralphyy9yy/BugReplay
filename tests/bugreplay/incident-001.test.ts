// ============================================================
// BugReplay Generated Regression Test
// Incident #1: TypeError: Cannot read properties of undefined (reading 'id')
// Generated: 2026-09-13T01:47:44.010Z
// DO NOT EDIT — regenerate with: bug-replay reproduce 1
// ============================================================

import { describe, it, expect } from "vitest";
import { processCheckout } from "../../src/checkout";

describe("processCheckout regression test for incident 1", () => {
  it("should reject with an authentication error when user is undefined", async () => {
    const order = { id: "order_123", items: [] };
    await expect(processCheckout(order, undefined)).rejects.toThrow(/auth|unauthorized|user/i);
  });
});
