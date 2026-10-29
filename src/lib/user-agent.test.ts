import { describe, expect, it } from "vitest";

import { describeUserAgent, displayIp } from "./user-agent";

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "Chrome on Windows",
      false,
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
      "Safari on macOS",
      false,
    ],
    [
      "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
      "Chrome on Android",
      true,
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1",
      "Chrome on iOS",
      true,
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "Edge on Windows",
      false,
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
      "Firefox on Linux",
      false,
    ],
  ])("%s", (ua, label, mobile) => {
    expect(describeUserAgent(ua)).toEqual({ label, mobile });
  });

  it("handles missing user agents", () => {
    expect(describeUserAgent(null).label).toBe("Unknown device");
  });
});

describe("displayIp", () => {
  it.each([
    ["0000:0000:0000:0000:0000:0000:0000:0000", null],
    ["::1", null],
    ["127.0.0.1", null],
    ["::ffff:127.0.0.1", null],
    ["192.168.1.20", null],
    ["203.0.113.7", "203.0.113.7"],
    ["::ffff:203.0.113.7", "203.0.113.7"],
    [null, null],
  ])("%s → %s", (ip, expected) => {
    expect(displayIp(ip)).toBe(expected);
  });
});
