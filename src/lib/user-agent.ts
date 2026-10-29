/** "Chrome on Windows"-style label for the sessions list. Deliberately simple. */
export function describeUserAgent(ua: string | null | undefined): {
  label: string;
  mobile: boolean;
} {
  if (!ua) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  const mobile = /Mobile|Android|iPhone|iPad/.test(ua);
  if (browser && os) return { label: `${browser} on ${os}`, mobile };
  return { label: browser ?? os ?? "Unknown device", mobile };
}

/** Hide addresses that say nothing useful: loopback, unspecified, private. */
export function displayIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const v = ip.replace(/^::ffff:/i, "");
  if (/^[0:]+$/.test(v) || v === "::1" || /^127\./.test(v)) return null;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(v)) return null;
  return v;
}
