import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { devices, expect, test, type Browser, type Page } from "@playwright/test";

// A cold dress rehearsal of the judge's first minute (docs/evals/rehearsal.md). Against a running
// deployment only: PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=rehearse
// Each of the five sample chips is asked twice: cold (a new phone: fresh browser, no cache, first
// sign in) and warm (the same phone asks again). For each it records the time to the first stage
// the server streams, the time until the teacher sees the outcome, the outcome, and whether the
// answer was replayed from the cache. No question or answer ids are written, and no secrets.
// REHEARSE_SLOW=1 adds a slow 3G network; REHEARSAL_OUT writes elsewhere (a dry run).
test.skip(!process.env.PW_BASE_URL, "the rehearsal runs against a deployment (PW_BASE_URL)");
test.describe.configure({ mode: "serial", timeout: 300_000 });

const CHIPS = ["letters", "numbers", "multilevel", "safety", "nocard"] as const;
type Row = { chip: string; pass: "cold" | "warm"; firstStageMs: number | null; outcomeMs: number | null; outcome: string; replayed: string };
const rows: Row[] = [];
const OUT = process.env.REHEARSAL_OUT ?? "docs/evals/rehearsal.md";

/** Times the first streamed stage of /api/ask from inside the page (the page's own clock). */
const TIMING = () => {
  const w = window as unknown as { __askStart?: number; __askFirst?: number; fetch: typeof fetch };
  const original = w.fetch.bind(window);
  w.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isAsk = /\/api\/ask(?:$|\?)/.test(url);
    if (isAsk) {
      w.__askStart = performance.now();
      w.__askFirst = undefined;
    }
    const res = await original(input, init);
    if (!isAsk || !res.body) return res;
    const [mine, theirs] = res.body.tee();
    void mine.getReader().read().then(() => {
      w.__askFirst ??= performance.now();
    });
    return new Response(theirs, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
};

async function slow3g(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 62_500, uploadThroughput: 62_500 });
}

async function newPhone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
  await context.addInitScript(TIMING);
  const page = await context.newPage();
  if (process.env.REHEARSE_SLOW === "1") await slow3g(page);
  await page.goto("/?lang=en");
  await page.locator('form[data-door="teacher"] button[type="submit"]').click();
  await expect(page.getByLabel("Signed in")).toBeVisible({ timeout: 60_000 });
  return page;
}

async function askChip(page: Page, chip: string, pass: Row["pass"]) {
  await page.goto("/t/ask?lang=en");
  await page.getByTestId(`sample-${chip}`).filter({ visible: true }).first().click();
  const answer = page.waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 180_000 }).then(() => "answer");
  const panel = page
    .locator('[data-testid^="outcome-"]')
    .first()
    .waitFor({ timeout: 180_000 })
    .then(async () => (await page.locator('[data-testid^="outcome-"]').first().getAttribute("data-testid"))!.replace("outcome-", ""));
  const failed = page.getByRole("alert").first().waitFor({ timeout: 180_000 }).then(() => "error");
  const outcome = await Promise.race([answer, panel, failed]).catch(() => "timeout");
  const t = await page.evaluate(() => {
    const w = window as unknown as { __askStart?: number; __askFirst?: number };
    const now = performance.now();
    return { first: w.__askStart !== undefined && w.__askFirst !== undefined ? w.__askFirst - w.__askStart : null, total: w.__askStart !== undefined ? now - w.__askStart : null };
  });
  let replayed = "n/a";
  if (outcome === "answer") {
    await page.getByRole("button", { name: /How this answer was made/ }).waitFor({ timeout: 60_000 }).catch(() => {});
    const badge = await page.getByText(/First answered|Answered before, shown again/).count();
    replayed = badge > 0 ? "yes" : "no";
  }
  rows.push({ chip, pass, firstStageMs: t.first, outcomeMs: t.total, outcome, replayed });
}

for (const chip of CHIPS) {
  test(`rehearse ${chip}: cold, then warm`, async ({ browser }) => {
    const page = await newPhone(browser);
    await askChip(page, chip, "cold");
    await askChip(page, chip, "warm");
    await page.context().close();
  });
}

test.afterAll(() => {
  const secs = (ms: number | null) => (ms === null ? "n/a" : (ms / 1000).toFixed(1));
  const origin = new URL(process.env.PW_BASE_URL!).origin;
  const lines = [
    "# Dress rehearsal · the five sample questions",
    "",
    `Run ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC against ${origin}, on an emulated Pixel 7${
      process.env.REHEARSE_SLOW === "1" ? " over slow 3G (400 ms, 500 kbit/s)" : " on the runner's own network"
    }, with \`pnpm exec playwright test --project=rehearse\` (tests/e2e/rehearse.spec.ts).`,
    "Cold: a new phone (fresh browser, no service worker, first sign in). Warm: the same phone asks again.",
    "First stage: from sending the question to the first stage the server streams. Outcome: until the teacher sees the answer or the outcome panel (measured to about 0.1 s). Replayed: the answer says it was shown again from the cache. No question or answer ids are kept.",
    "",
    "| Sample question | Pass | First stage (s) | Outcome shown (s) | Outcome | Replayed |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.chip} | ${r.pass} | ${secs(r.firstStageMs)} | ${secs(r.outcomeMs)} | ${r.outcome} | ${r.replayed} |`),
    "",
  ];
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, lines.join("\n"));
});
