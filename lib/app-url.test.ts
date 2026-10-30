import { describe, expect, it } from "vitest";
import { appBaseUrl, originFromHeaders, shareBaseUrl } from "./app-url";

describe("app urls (D36)", () => {
  it("shares production links even from a preview", () => {
    const env = {
      VERCEL_ENV: "preview",
      VERCEL_URL: "x-git-y.vercel.app",
      VERCEL_PROJECT_PRODUCTION_URL: "parampara-eta.vercel.app",
    };
    expect(shareBaseUrl(null, env)).toBe("https://parampara-eta.vercel.app");
    expect(appBaseUrl(null, env)).toBe("https://x-git-y.vercel.app");
  });

  it("locally prefers the request origin over a stale env port", () => {
    const env = { NEXT_PUBLIC_APP_URL: "http://localhost:3000" };
    expect(shareBaseUrl("http://localhost:3070", env)).toBe("http://localhost:3070");
    expect(appBaseUrl(null, env)).toBe("http://localhost:3000");
    expect(appBaseUrl(null, {})).toBe("http://localhost:3070");
  });

  it("reads the origin from forwarded headers", () => {
    const h = new Headers({ host: "localhost:3070" });
    expect(originFromHeaders(h)).toBe("http://localhost:3070");
    const v = new Headers({
      "x-forwarded-host": "parampara-eta.vercel.app",
      "x-forwarded-proto": "https",
    });
    expect(originFromHeaders(v)).toBe("https://parampara-eta.vercel.app");
  });
});
