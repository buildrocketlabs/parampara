// The bad network numbers /how shows, exactly as docs/evals/network.md recorded them on the live
// site (tests/e2e/network.spec.ts). lib/how/network.test.ts fails if they drift from that file.

export const NETWORK_MEASURED = {
  date: "2026-10-27",
  /** Home page, Slow 3G, a fresh phone: first contentful paint. */
  coldFirstPaint: "6.2 s",
  /** Home page, Slow 3G, a returning phone (service worker in control): first contentful paint. */
  warmFirstPaint: "2.7 s",
  /** A sample question's chip, tapped on Slow 3G, to its answer page. */
  sampleAnswer: "6.7 s",
} as const;

export const NETWORK_SOURCE_URL =
  "https://github.com/buildrocketlabs/parampara/blob/main/docs/evals/network.md";
