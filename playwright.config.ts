import { defineConfig, devices } from "@playwright/test";

// e2e runs against a production build (no dev overlay in screenshots).
// Set PW_BASE_URL to test an already running server or a preview deployment instead.
const PORT = Number(process.env.PW_PORT ?? 3123);
const external = process.env.PW_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // CI runners have two cores; two workers keep the smoke run well under the job timeout.
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "smoke",
      testMatch: /(smoke|entry|import)\.spec\.ts$/,
      use: { ...devices["Pixel 7"] },
    },
    {
      // Against a real deployment only: PW_BASE_URL=https://parampara-eta.vercel.app
      name: "live",
      testMatch: /live\.spec\.ts$/,
      use: { ...devices["Pixel 7"] },
    },
    {
      // The judge's hour on the live deployment (.claude/skills/demo-path). Needs PW_BASE_URL.
      name: "judge",
      testMatch: /judge\.spec\.ts$/,
      use: { ...devices["Pixel 7"] },
    },
    {
      // A cold and warm dress rehearsal of the five sample questions, written to
      // docs/evals/rehearsal.md. Needs PW_BASE_URL; each chip opens its own fresh phone.
      name: "rehearse",
      testMatch: /rehearse\.spec\.ts$/,
      use: { browserName: "chromium" },
    },
    {
      // Phone clips for the submission video (docs/story/README.md), recorded by the spec itself.
      // PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=story
      name: "story",
      testMatch: /story\.spec\.ts$/,
      use: { browserName: "chromium" },
    },
    {
      // Law 9 on a deployment: DevTools 3G presets, cold and warm, then offline. Writes
      // docs/evals/network.md. PW_BASE_URL=… pnpm exec playwright test --project=network --workers=1
      name: "network",
      testMatch: /network\.spec\.ts$/,
      use: { browserName: "chromium" },
    },
    {
      // Answer latency on a deployment (docs/evals/latency.md): sample chips, then fresh questions,
      // with a spend cap. PW_BASE_URL=… LATENCY_LABEL=after pnpm exec playwright test --project=latency
      name: "latency",
      testMatch: /latency\.spec\.ts$/,
      use: { browserName: "chromium" },
    },
    {
      // Warms the five sample chips (D87) after a library or prompt change: pnpm warm:chips
      name: "warm",
      testMatch: /warm\.spec\.ts$/,
      use: { browserName: "chromium" },
    },
    {
      // Natural typed questions on a deployment (docs/evals/probe-2026-10-28.md); spends credits.
      // PW_BASE_URL=… pnpm exec playwright test --project=probe --workers=1
      name: "probe",
      testMatch: /probe\.spec\.ts$/,
      use: { browserName: "chromium" },
    },
    {
      name: "shots",
      testMatch: /shots\.spec\.ts$/,
      use: { browserName: "chromium" },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: `pnpm build && pnpm start -p ${PORT}`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        // PW_FIXTURE=1 builds without the founder's keys, as CI does: fixture mode, Sample data.
        env: process.env.PW_FIXTURE
          ? {
              NEXT_PUBLIC_SUPABASE_URL: "",
              NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
              SUPABASE_SERVICE_ROLE_KEY: "",
            }
          : undefined,
        timeout: 240_000,
      },
});
