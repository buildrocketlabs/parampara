import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { encodeWav16 } from "../../lib/audio/wav";

// The real browser decode path (Web Audio, not a stand in) on the import page, in fixture mode:
// the recording is prepared on the device and nothing is sent (docs/BUILD.md M2.1).
const fixture = !process.env.NEXT_PUBLIC_SUPABASE_URL;

function speechLike(seconds: number, rate = 44_100): Float32Array {
  // Bursts of a voiced tone with pauses, roughly like someone talking.
  const out = new Float32Array(seconds * rate);
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    const talking = Math.sin(2 * Math.PI * 0.4 * t) > -0.2;
    out[i] = talking
      ? 0.3 * Math.sin(2 * Math.PI * 180 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t))
      : 0;
  }
  return out;
}

const dir = mkdtempSync(join(tmpdir(), "pp-import-"));
const wavPath = join(dir, "master-part-1.wav");
writeFileSync(wavPath, encodeWav16(speechLike(70), 44_100));
let m4aPath: string | null = join(dir, "master-part-2.m4a");
try {
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    wavPath,
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    m4aPath,
  ]);
} catch {
  m4aPath = null;
}

test.describe("import a recording", () => {
  test.skip(!fixture, "fixture mode only (no keys in this build)");

  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: "pp_fixture_role", value: "reviewer", url: baseURL! }]);
  });

  test("decodes and cuts a phone recording in the browser, under 30 s a piece", async ({
    page,
  }) => {
    await page.goto("/m/import?lang=en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Bring in a master's recording",
    );
    // The Sample reviewer banner is a second note on this page; check the import's own.
    await expect(page.getByRole("note").filter({ hasText: "Sample mode" })).toBeVisible();
    const files = [wavPath, ...(m4aPath ? [m4aPath] : [])];
    await page
      .locator('[role="radio"][aria-checked]')
      .filter({ hasText: /consent line is at the start|ಆರಂಭದಲ್ಲೇ ಇದೆ/ })
      .first()
      .click();
    await page.getByTestId("import-files").setInputFiles(files);
    await page.getByTestId("import-begin").click();
    const plan = page.getByTestId("import-plan");
    await expect(plan).toBeVisible({ timeout: 30_000 });
    // 70 s (plus 70 s of m4a) at under 29 s a piece is at least 3 (or 5) pieces.
    const text = await plan.innerText();
    const pieces = Number(await plan.getAttribute("data-chunks"));
    expect(pieces).toBeGreaterThanOrEqual(m4aPath ? 5 : 3);
    expect(text).toMatch(m4aPath ? /2 min 2\d s/ : /1 min 10 s/);
  });

  test("a room without a session never dead ends", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/m/import?lang=en");
    await expect(page.getByRole("link", { name: /Back to home/ })).toBeVisible();
  });
});
