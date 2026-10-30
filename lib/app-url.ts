// Where links we send (invites, WhatsApp shares, auth redirects) should point (DECISIONS D36).
// Production links always use the production domain, even when made from a preview, because a
// teacher's invite must outlive any preview. Locally the request's own origin wins, so the dev
// port never has to match an env var.

type Env = Record<string, string | undefined>;

const LOCAL_DEFAULT = "http://localhost:3070";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** The address a teacher's phone should open. */
export function shareBaseUrl(requestOrigin?: string | null, env: Env = process.env): string {
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return appBaseUrl(requestOrigin, env);
}

/** The address of this deployment (preview, production or local). */
export function appBaseUrl(requestOrigin?: string | null, env: Env = process.env): string {
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  if (requestOrigin) return trimSlash(requestOrigin);
  if (env.NEXT_PUBLIC_APP_URL) return trimSlash(env.NEXT_PUBLIC_APP_URL);
  return LOCAL_DEFAULT;
}

/** Origin of the current request from forwarded headers (Vercel and local both set host). */
export function originFromHeaders(h: Pick<Headers, "get">): string | null {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
