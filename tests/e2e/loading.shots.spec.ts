import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Route loading for /m, /r, /i and /how (F-D): Hanate thinking beside one honest line, above
// skeletons shaped like the room. A room's loading boundary shows while the router knows the
// room's shape (from the route tree prefetch, or a page of the same room already open) but not
// yet the page. So the spec lets the tree through, holds the page, navigates on the client and
// photographs what the phone shows in the meantime.
// Run: PW_PORT=3191 PW_FIXTURE=1 pnpm exec playwright test tests/e2e/loading.shots.spec.ts --project=shots
const dir = "docs/demos/F-D";
mkdirSync(dir, { recursive: true });

const rooms = [
  { path: "/m", from: "/m/talk", name: "m", kn: "ನಿಮ್ಮ ಕೋಣೆಯ ದೀಪ", en: "the lamp in your room" },
  {
    path: "/r",
    from: "/r/cards",
    name: "r",
    kn: "ಕಾದಿರುವುದನ್ನು",
    en: "what waits for you",
  },
  {
    path: "/i",
    from: "/i/lamps",
    name: "i",
    kn: "ಈ ವಾರದ ಎಣಿಕೆ",
    en: "Counting this week",
  },
  {
    path: "/how",
    from: "/",
    name: "how",
    kn: "ಉತ್ತರದ ಹಿಂದಿನ ದಾರಿ",
    en: "the path behind each answer",
  },
] as const;

declare global {
  interface Window {
    next?: { router?: { push: (href: string) => void; prefetch: (href: string) => void } };
  }
}

for (const lang of ["kn", "en"] as const) {
  for (const room of rooms) {
    test(`${room.path} loading (390, ${lang})`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript((l) => window.localStorage.setItem("parampara.lang", l), lang);

      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route(
        (url) => url.pathname === room.path && url.searchParams.has("_rsc"),
        async (route) => {
          const segment = route.request().headers()["next-router-segment-prefetch"] ?? "";
          if (segment && !segment.includes("__PAGE__")) return route.continue();
          await held;
          await route.continue().catch(() => {});
        },
      );
      await page.goto(room.from);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate((href) => window.next?.router?.prefetch(href), room.path);
      await page.waitForTimeout(1500);
      await page.evaluate((href) => window.next?.router?.push(href), room.path);

      const status = page.locator("main[aria-busy=true] [role=status]");
      await expect(status).toBeVisible();
      await expect(
        status.locator(`span[lang=${lang}]`).filter({ visible: true }).first(),
      ).toContainText(room[lang]);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/loading-${room.name}-390-${lang}.png` });

      // Reduced motion: the same screen, held still (the skeletons stop breathing).
      if (lang === "kn") {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${dir}/loading-${room.name}-390-reduced.png` });
      }
      release();
    });
  }
}
