import type { MetadataRoute } from "next";

// /robots.txt, so it is a plain answer instead of a 404 (F-P2). Everything may be read: private
// rooms are behind sign in and say "noindex" on their own pages. No sitemap: there is nothing to list.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" } };
}
