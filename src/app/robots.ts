import type { MetadataRoute } from "next";

/** Only the public pages are worth crawling; everything else asks for a sign-in. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/$", "/login", "/design"], disallow: "/" },
  };
}
