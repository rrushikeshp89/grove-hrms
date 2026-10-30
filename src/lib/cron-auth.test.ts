import { describe, expect, it } from "vitest";

import { cronAuth } from "./cron-auth";

const secret = "a-long-enough-secret-value";

describe("cronAuth", () => {
  it("accepts the exact bearer token", () => {
    expect(cronAuth(`Bearer ${secret}`, secret)).toBe("ok");
  });

  it("denies anything else, including near misses and a missing header", () => {
    expect(cronAuth(null, secret)).toBe("denied");
    expect(cronAuth("", secret)).toBe("denied");
    expect(cronAuth(secret, secret)).toBe("denied");
    expect(cronAuth(`Bearer ${secret}x`, secret)).toBe("denied");
    expect(cronAuth(`Bearer ${secret.slice(0, -1)}y`, secret)).toBe("denied");
  });

  it("is off when no usable secret is set, even for a matching header", () => {
    expect(cronAuth("Bearer ", undefined)).toBe("unconfigured");
    expect(cronAuth("Bearer short", "short")).toBe("unconfigured");
    expect(cronAuth("Bearer ", "")).toBe("unconfigured");
  });
});
