import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";
import { devices, expect, test, type Browser, type Page } from "@playwright/test";

// The teacher's answer, timed on a deployment (docs/evals/latency.md, Track B). The judged path:
// tap a sample chip or type a question on /t/ask → stages stream → the answer's text → its voice.
//
//   PW_BASE_URL=https://parampara-eta.vercel.app LATENCY_LABEL=after \
//     pnpm exec playwright test --project=latency --workers=1
//
// It asks the five sample chips in English and in Kannada (they should replay from the answer
// cache, D35), then LATENCY_QUESTIONS fresh questions (default 8) whose wording changes on every
// run, so the cache cannot hit them. Each fresh question costs about 2 to 3 US cents. Spend guards:
// more than 15 fresh questions is refused, and asking stops once the traces of fresh answers add
// up to LATENCY_MAX_USD (default 0.50). No question or answer ids are written, and no secrets.
// It appends a dated section to docs/evals/latency.md (and a before/after table when a "before"
// run exists) and keeps the raw numbers in docs/evals/latency/<stamp>-<label>.json.
test.skip(!process.env.PW_BASE_URL, "the latency run needs a deployment (PW_BASE_URL)");
test.describe.configure({ mode: "serial", timeout: 1_800_000 });
// A missing control fails fast instead of holding the run until the test timeout.
test.use({ actionTimeout: 20_000 });

const LABEL =
  (process.env.LATENCY_LABEL ?? "run").replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "run";
const FRESH = Number(process.env.LATENCY_QUESTIONS ?? 8);
const MAX_FRESH = 15;
const MAX_USD = Number(process.env.LATENCY_MAX_USD ?? 0.5);
const SKIP_CHIPS = process.env.LATENCY_CHIPS === "0";
const OUT_MD = process.env.LATENCY_OUT ?? "docs/evals/latency.md";
const RAW_DIR = "docs/evals/latency";
const CHIPS = ["letters", "numbers", "multilevel", "safety", "nocard"] as const;

type Stage = { stage: string; at: number };
type TraceRow = { kind: string; ms: number | null; usd: number | null };
type Row = {
  what: string;
  lang: "en" | "kn";
  chip: boolean;
  outcome: string;
  replayed: boolean | null;
  /** From the tap: each streamed stage, the outcome, the first answer step on screen, the voice URL. */
  stages: Stage[];
  outcomeMs: number | null;
  textMs: number | null;
  voiceMs: number | null;
  /** The voice request itself (from its start on the answer page to its reply). */
  voiceRequestMs: number | null;
  voiceStatus: number | null;
  trace: TraceRow[];
  traceTotalMs: number | null;
  costUsd: number | null;
};
const rows: Row[] = [];
let spent = 0;

/** Every run words its fresh questions differently (class size, opening), so none is a replay. */
function freshQuestions(seed: number) {
  const n = (k: number) => 18 + ((seed >> k) % 23);
  const open = ["", "Please help. ", "One more question. ", "Tonight I am planning. "][seed % 4]!;
  const openKn = ["", "ದಯವಿಟ್ಟು ಸಹಾಯ ಮಾಡಿ. ", "ಇನ್ನೊಂದು ಪ್ರಶ್ನೆ. ", "ನಾಳೆಯ ತಯಾರಿ. "][seed % 4]!;
  // Each targets a problem the Sample library answers (evals/library.json), worded afresh.
  return [
    {
      lang: "kn" as const,
      text: `${openKn}ನನ್ನ ಒಂದನೇ ತರಗತಿಯ ${n(1)} ಮಕ್ಕಳಲ್ಲಿ ಕೆಲವರು ಇನ್ನೂ ಒಂದು ಅಕ್ಷರವನ್ನೂ ಗುರುತಿಸುವುದಿಲ್ಲ. ನಾಳೆ ಏನು ಮಾಡಲಿ?`,
    },
    {
      lang: "en" as const,
      text: `${open}My ${n(2)} children can count to a hundred by heart but cannot tell me how many fourteen is. What should I try?`,
    },
    {
      lang: "kn" as const,
      text: `${openKn}ಎರಡನೇ ತರಗತಿಯ ${n(3)} ಮಕ್ಕಳಿಗೆ ಅಕ್ಷರ ಗೊತ್ತು, ಆದರೆ ಅಕ್ಷರ ಕೂಡಿಸಿ ಪದ ಓದಲು ಆಗುವುದಿಲ್ಲ. ಹೇಗೆ ಕಲಿಸಲಿ?`,
    },
    {
      lang: "en" as const,
      text: `${open}I have class 1 and class 2 in one room, ${n(4)} children, and I am the only teacher. How do I manage both?`,
    },
    {
      lang: "kn" as const,
      text: `${openKn}${n(5)} ಮಕ್ಕಳ ತರಗತಿಯಲ್ಲಿ ಒಂದು ಮಗು ಏನೂ ಮಾತನಾಡದೆ ಸುಮ್ಮನೆ ಕೂರುತ್ತದೆ. ಆ ಮಗುವಿಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`,
    },
    {
      lang: "en" as const,
      text: `${open}About ${n(6)} of my children speak Lambani at home and know almost no Kannada. How do I begin?`,
    },
    {
      lang: "kn" as const,
      text: `${openKn}ನನ್ನ ${n(7)} ಮಕ್ಕಳಲ್ಲಿ ಕೆಲವರು ಮನೆಯಲ್ಲಿ ಕೆಲಸ ಇರುವುದರಿಂದ ಮನೆಗೆಲಸ ತರುವುದಿಲ್ಲ. ಏನು ಮಾಡಲಿ?`,
    },
    {
      lang: "en" as const,
      text: `${open}In my class of ${n(8)}, some children read well and others are still learning. How can the readers help the rest?`,
    },
    {
      lang: "kn" as const,
      text: `${openKn}ಓದಲು ಬಾರದ ಪೋಷಕರು ಮಕ್ಕಳ ಕಲಿಕೆಯಲ್ಲಿ ಭಾಗವಹಿಸುವುದಿಲ್ಲ. ${n(9)} ಮಕ್ಕಳ ಪೋಷಕರನ್ನು ಹೇಗೆ ಸೇರಿಸಲಿ?`,
    },
    {
      lang: "en" as const,
      text: `${open}A few of my ${n(10)} class 1 children still cannot recognise any letter after six months of school. Where do I start?`,
    },
    {
      lang: "kn" as const,
      text: `${openKn}ಮಕ್ಕಳು ಒಂದರಿಂದ ನೂರು ಹೇಳುತ್ತಾರೆ, ಆದರೆ ${n(11)} ಕಡ್ಡಿ ಕೊಟ್ಟರೆ ಎಷ್ಟು ಎಂದು ಹೇಳಲು ಆಗುವುದಿಲ್ಲ. ಏನು ಮಾಡಲಿ?`,
    },
    {
      lang: "en" as const,
      text: `${open}My class 2 children know their letters but stop at every word when they read. ${n(12)} children. What helps?`,
    },
    {
      lang: "kn" as const,
      text: `${openKn}ಒಂದು ಮತ್ತು ಎರಡನೇ ತರಗತಿ ಒಂದೇ ಕೋಣೆಯಲ್ಲಿ, ${n(13)} ಮಕ್ಕಳು. ಎರಡೂ ಗುಂಪನ್ನು ಹೇಗೆ ಕಲಿಸಲಿ?`,
    },
    {
      lang: "en" as const,
      text: `${open}One child out of ${n(14)} never speaks in class and sits alone at the back. What can I do tomorrow?`,
    },
    {
      lang: "kn" as const,
      text: `${openKn}ತರಗತಿಯ ${n(15)} ಮಕ್ಕಳಲ್ಲಿ ಕೆಲವರು ಓದುತ್ತಾರೆ, ಕೆಲವರು ಇನ್ನೂ ಕಲಿಯುತ್ತಿದ್ದಾರೆ. ಜೋಡಿಯಾಗಿ ಓದಿಸುವುದು ಹೇಗೆ?`,
    },
  ];
}

/** In the page: the stages of /api/ask as they arrive, and the answer's voice request. */
const TIMING = () => {
  type W = {
    __t0?: number;
    __stages?: Array<{ stage: string; at: number }>;
    __outcomeAt?: number;
    __voiceStart?: number;
    __voiceEnd?: number;
    __voiceStatus?: number;
    fetch: typeof fetch;
  };
  const w = window as unknown as W;
  const original = w.fetch.bind(window);
  w.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (/\/api\/answers\/[0-9a-f-]{36}\/voice/.test(url)) {
      w.__voiceStart ??= performance.now();
      const res = await original(input, init);
      w.__voiceEnd ??= performance.now();
      w.__voiceStatus ??= res.status;
      return res;
    }
    const res = await original(input, init);
    if (!/\/api\/ask(?:$|\?)/.test(url) || !res.body) return res;
    const [mine, theirs] = res.body.tee();
    void (async () => {
      const reader = mine.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        buf += dec.decode(value, { stream: !done });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          try {
            const msg = JSON.parse(line) as { stage?: string; outcome?: unknown };
            if (msg.stage) (w.__stages ??= []).push({ stage: msg.stage, at: performance.now() });
            if (msg.outcome) w.__outcomeAt ??= performance.now();
          } catch {
            // not ours to judge
          }
        }
        if (done) break;
      }
    })();
    return new Response(theirs, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
};

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}

async function newPhone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
  await context.addInitScript(TIMING);
  const page = await context.newPage();
  await open(page, "/?lang=en");
  await page.locator('form[data-door="teacher"] button[type="submit"]').click();
  await expect(page.getByLabel("Signed in")).toBeVisible({ timeout: 60_000 });
  return page;
}

/** Clears the page's clocks and marks the tap. */
async function markTap(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    for (const k of [
      "__stages",
      "__outcomeAt",
      "__voiceStart",
      "__voiceEnd",
      "__voiceStatus",
      "__textAt",
    ])
      delete w[k];
    w.__t0 = performance.now();
  });
}

function parseMs(v: string): number | null {
  const m = /^([\d.]+)\s*(ms|s)$/.exec(v.trim());
  if (!m) return null;
  return m[2] === "ms" ? Number(m[1]) : Math.round(Number(m[1]) * 1000);
}
function parseUsd(v: string): number | null {
  const t = v.trim();
  if (t.startsWith("<$")) return 0.0005;
  const m = /^\$([\d.]+)$/.exec(t);
  return m ? Number(m[1]) : null;
}

async function readTrace(
  page: Page,
): Promise<{ steps: TraceRow[]; totalMs: number | null; usd: number | null }> {
  const button = page
    .getByRole("button", { name: /How this answer was made|ಈ ಉತ್ತರ ಹೇಗೆ ತಯಾರಾಯಿತು/ })
    .filter({ visible: true })
    .first();
  if (!(await button.count())) return { steps: [], totalMs: null, usd: null };
  await button.click();
  await page
    .locator("li[data-kind]")
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
  const raw = await page.$$eval("li[data-kind]", (items) =>
    items.map((li) => ({
      kind: li.getAttribute("data-kind") ?? "",
      meta: [...li.querySelectorAll("ul > li")].map((m) => (m.textContent ?? "").trim()),
    })),
  );
  const steps = raw.map((r) => ({
    kind: r.kind,
    ms: r.meta.map(parseMs).find((x) => x !== null) ?? null,
    usd: r.meta.map(parseUsd).find((x) => x !== null) ?? null,
  }));
  // "Total" line: "12.3 s · $0.021" in the drawer.
  const total = await page
    .getByText(/^(Total|ಒಟ್ಟು)/)
    .filter({ visible: true })
    .first()
    .locator("xpath=..")
    .innerText()
    .catch(() => "");
  const tm = /([\d.]+\s*(?:ms|s))/.exec(total);
  const tu = /(<?\$[\d.]+)/.exec(total);
  await page.keyboard.press("Escape").catch(() => {});
  return { steps, totalMs: tm ? parseMs(tm[1]!) : null, usd: tu ? parseUsd(tu[1]!) : null };
}

async function askOnce(
  page: Page,
  what: string,
  lang: "en" | "kn",
  chip: boolean,
  send: () => Promise<void>,
) {
  await markTap(page);
  await send();
  const answer = page
    .waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 120_000 })
    .then(() => "answered");
  const panel = page
    .locator('[data-testid^="outcome-"]')
    .first()
    .waitFor({ timeout: 120_000 })
    .then(async () =>
      (await page
        .locator('[data-testid^="outcome-"]')
        .first()
        .getAttribute("data-testid"))!.replace("outcome-", ""),
    );
  // The ask screen's own error panel (Next's route announcer is a role=alert too, outside main,
  // and an outcome panel such as Childline may carry one: an outcome panel wins).
  const failed = page
    .locator('main [role="alert"]')
    .filter({ visible: true })
    .first()
    .waitFor({ timeout: 120_000 })
    .then(async () => {
      await page.waitForTimeout(300);
      const p = page.locator('[data-testid^="outcome-"]').first();
      return (await p.count())
        ? ((await p.getAttribute("data-testid")) ?? "").replace("outcome-", "")
        : "error";
    });
  const outcome = await Promise.race([answer, panel, failed]).catch(() => "timeout");
  let replayed: boolean | null = null;
  if (outcome === "answered") {
    await page
      .waitForFunction(
        () => {
          const w = window as unknown as { __textAt?: number };
          if (document.querySelector("li[data-card]")) w.__textAt ??= performance.now();
          return w.__textAt !== undefined;
        },
        undefined,
        { timeout: 60_000, polling: "raf" },
      )
      .catch(() => {});
    await page
      .waitForFunction(
        () => (window as unknown as { __voiceEnd?: number }).__voiceEnd !== undefined,
        undefined,
        { timeout: 60_000 },
      )
      .catch(() => {});
    replayed =
      (await page
        .getByText(/First answered|Answered before|ಮೊದಲು ಉತ್ತರಿಸಿದ್ದು|ಮೊದಲೇ ಉತ್ತರಿಸಿದ್ದು/)
        .count()) > 0;
  }
  const t = await page.evaluate(() => {
    const w = window as unknown as {
      __t0?: number;
      __stages?: Array<{ stage: string; at: number }>;
      __outcomeAt?: number;
      __textAt?: number;
      __voiceStart?: number;
      __voiceEnd?: number;
      __voiceStatus?: number;
    };
    const rel = (x?: number) =>
      x === undefined || w.__t0 === undefined ? null : Math.round(x - w.__t0);
    return {
      stages: (w.__stages ?? []).map((s) => ({ stage: s.stage, at: rel(s.at) ?? 0 })),
      outcomeMs: rel(w.__outcomeAt),
      textMs: rel(w.__textAt),
      voiceMs: rel(w.__voiceEnd),
      voiceRequestMs:
        w.__voiceStart !== undefined && w.__voiceEnd !== undefined
          ? Math.round(w.__voiceEnd - w.__voiceStart)
          : null,
      voiceStatus: w.__voiceStatus ?? null,
    };
  });
  const trace =
    outcome === "answered" ? await readTrace(page) : { steps: [], totalMs: null, usd: null };
  const row: Row = {
    what,
    lang,
    chip,
    outcome,
    replayed,
    ...t,
    trace: trace.steps,
    traceTotalMs: trace.totalMs,
    costUsd: replayed ? 0 : trace.usd,
  };
  // Escalations and "no card" show no trace: count a cent for the triage and ranking they may cost.
  spent += row.costUsd ?? (outcome === "answered" ? 0.03 : replayed ? 0 : 0.01);
  rows.push(row);
  return row;
}

test("latency: sample chips, then fresh questions", async ({ browser }) => {
  if (!Number.isInteger(FRESH) || FRESH < 0 || FRESH > MAX_FRESH) {
    throw new Error(
      `LATENCY_QUESTIONS must be 0 to ${MAX_FRESH} (spend guard); got ${process.env.LATENCY_QUESTIONS}`,
    );
  }
  const page = await newPhone(browser);

  if (!SKIP_CHIPS) {
    for (const lang of ["en", "kn"] as const) {
      for (const chip of CHIPS) {
        await open(page, `/t/ask?lang=${lang}`);
        await askOnce(page, chip, lang, true, () =>
          page.getByTestId(`sample-${chip}`).filter({ visible: true }).first().click(),
        );
      }
    }
  }

  const seed = Math.floor(Date.now() / 1000);
  for (const q of freshQuestions(seed).slice(0, FRESH)) {
    if (spent >= MAX_USD) {
      console.warn(`[latency] stopped: about $${spent.toFixed(3)} spent (cap $${MAX_USD})`);
      break;
    }
    await open(page, `/t/ask?lang=${q.lang}`);
    await askOnce(
      page,
      `fresh ${rows.filter((r) => !r.chip).length + 1}`,
      q.lang,
      false,
      async () => {
        await page
          .getByRole("button", { name: /Type it instead|ಬರೆದು ಕೇಳಿ/ })
          .filter({ visible: true })
          .first()
          .click();
        await page.locator("textarea").filter({ visible: true }).first().fill(q.text);
        await page.locator("form button[type=submit]").filter({ visible: true }).first().click();
      },
    );
  }
  await page.context().close();
});

// ── Report ──────────────────────────────────────────────────────────────────────────────────────

function pct(xs: number[], p: number): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  if (p === 50) {
    const mid = (v.length - 1) / 2;
    return (v[Math.floor(mid)]! + v[Math.ceil(mid)]!) / 2;
  }
  return v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)]!;
}
const s = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? "n/a" : (ms / 1000).toFixed(1);

type Summary = {
  label: string;
  at: string;
  freshN: number;
  freshAnswered: number;
  textP50: number | null;
  textP95: number | null;
  audioP50: number | null;
  chipN: number;
  chipReplayed: number;
  chipOutcomeP50: number | null;
  chipOutcomeMax: number | null;
  stageP50: Record<string, number | null>;
  phaseP50: Record<string, number | null>;
  spentUsd: number;
};

function summarise(all: Row[], label: string, at: string): Summary {
  const fresh = all.filter((r) => !r.chip);
  const ans = fresh.filter((r) => r.outcome === "answered" && r.replayed === false);
  const chips = all.filter((r) => r.chip);
  const stage = (kind: string) =>
    pct(
      ans.map((r) => r.trace.find((t) => t.kind === kind)?.ms ?? NaN),
      50,
    );
  const at_ = (r: Row, st: string) => r.stages.find((x) => x.stage === st)?.at ?? NaN;
  return {
    label,
    at,
    freshN: fresh.length,
    freshAnswered: ans.length,
    textP50: pct(
      ans.map((r) => r.textMs ?? NaN),
      50,
    ),
    textP95: pct(
      ans.map((r) => r.textMs ?? NaN),
      95,
    ),
    audioP50: pct(
      ans.map((r) => r.voiceMs ?? NaN),
      50,
    ),
    chipN: chips.length,
    chipReplayed: chips.filter(
      (r) =>
        r.replayed === true ||
        (r.outcome !== "answered" &&
          r.outcome !== "timeout" &&
          r.outcome !== "error" &&
          (r.outcomeMs ?? Infinity) < 3000),
    ).length,
    chipOutcomeP50: pct(
      chips.map((r) => r.outcomeMs ?? NaN),
      50,
    ),
    chipOutcomeMax: pct(
      chips.map((r) => r.outcomeMs ?? NaN),
      100,
    ),
    stageP50: {
      triage: stage("triage"),
      retrieval: stage("retrieval"),
      draft: stage("draft"),
      grounding: stage("grounding"),
      safety: stage("safety"),
      traceTotal: pct(
        ans.map((r) => r.traceTotalMs ?? NaN),
        50,
      ),
    },
    phaseP50: {
      understanding: pct(
        ans.map((r) => at_(r, "finding") - at_(r, "understanding")),
        50,
      ),
      findingAndDrafting: pct(
        ans.map((r) => at_(r, "checking") - at_(r, "finding")),
        50,
      ),
      checkingToOutcome: pct(
        ans.map((r) => (r.outcomeMs ?? NaN) - at_(r, "checking")),
        50,
      ),
      outcomeToText: pct(
        ans.map((r) => (r.textMs ?? NaN) - (r.outcomeMs ?? NaN)),
        50,
      ),
      textToVoice: pct(
        ans.map((r) => (r.voiceMs ?? NaN) - (r.textMs ?? NaN)),
        50,
      ),
    },
    spentUsd: Math.round(spent * 1000) / 1000,
  };
}

test.afterAll(() => {
  if (!rows.length) return;
  const at = new Date().toISOString();
  const stamp = at.slice(0, 16).replace(/[:T]/g, "-");
  const sum = summarise(rows, LABEL, at);
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(
    join(RAW_DIR, `${stamp}-${LABEL}.json`),
    `${JSON.stringify({ summary: sum, rows }, null, 2)}\n`,
  );

  const origin = new URL(process.env.PW_BASE_URL!).origin;
  const stagesOf = (r: Row) => r.stages.map((x) => `${x.stage[0]} ${s(x.at)}`).join(", ");
  const traceOf = (r: Row) =>
    r.replayed
      ? "replayed"
      : r.trace
          .filter((t) => t.ms !== null)
          .map((t) => `${t.kind} ${s(t.ms)}`)
          .join(", ") || "n/a";
  const lines = [
    "",
    `## ${LABEL} · ${at.slice(0, 16).replace("T", " ")} UTC`,
    "",
    `Against ${origin}, one emulated Pixel 7 (Chromium) as the one tap Sample teacher, on the runner's own network, by \`tests/e2e/latency.spec.ts\` (Playwright project \`latency\`). Times are from the tap, on the page's own clock: each streamed stage (u understanding, f finding, c checking), the outcome, the first answer step on screen (text) and the reply of the answer's voice request (voice ready to play). Stage times inside the trace are the server's own spans. About $${sum.spentUsd.toFixed(3)} of model time spent (fresh answers' traces).`,
    "",
    "| Question | Lang | Outcome | Replayed | Stages (s) | Outcome (s) | Text (s) | Voice ready (s) | Voice request (s) | Trace spans (s) | Trace total (s) |",
    "|---|---|---|---|---|---:|---:|---:|---:|---|---:|",
    ...rows.map(
      (r) =>
        `| ${r.chip ? `chip ${r.what}` : r.what} | ${r.lang} | ${r.outcome} | ${r.replayed === null ? "n/a" : r.replayed ? "yes" : "no"} | ${stagesOf(r) || "n/a"} | ${s(r.outcomeMs)} | ${s(r.textMs)} | ${s(r.voiceMs)}${r.voiceStatus && r.voiceStatus !== 200 ? ` (${r.voiceStatus})` : ""} | ${s(r.voiceRequestMs)} | ${traceOf(r)} | ${r.replayed ? "n/a" : s(r.traceTotalMs)} |`,
    ),
    "",
    `Summary (${LABEL}): fresh answered ${sum.freshAnswered} of ${sum.freshN}; time to text p50 **${s(sum.textP50)} s**, p95 **${s(sum.textP95)} s**; time to voice ready p50 **${s(sum.audioP50)} s**. Sample chips: ${sum.chipReplayed} of ${sum.chipN} served from the cache or under 3 s, outcome p50 ${s(sum.chipOutcomeP50)} s, slowest ${s(sum.chipOutcomeMax)} s.`,
    "",
    `Trace span p50 (fresh answers): triage with the name reader ${s(sum.stageP50.triage)} s · ranking ${s(sum.stageP50.retrieval)} s · drafting ${s(sum.stageP50.draft)} s · grounding (slowest judge) ${s(sum.stageP50.grounding)} s · safety ${s(sum.stageP50.safety)} s · trace total ${s(sum.stageP50.traceTotal)} s.`,
    `Wall clock phase p50: tap to finding ${s(sum.phaseP50.understanding)} s · finding to checking ${s(sum.phaseP50.findingAndDrafting)} s · checking to outcome ${s(sum.phaseP50.checkingToOutcome)} s · outcome to text on screen ${s(sum.phaseP50.outcomeToText)} s · text to voice ready ${s(sum.phaseP50.textToVoice)} s.`,
  ];

  // Before and after, when this run is not the baseline and a baseline exists.
  if (LABEL !== "before" && existsSync(RAW_DIR)) {
    const before = readdirSync(RAW_DIR)
      .filter((f) => f.endsWith("-before.json"))
      .sort()
      .pop();
    if (before) {
      const b = (JSON.parse(readFileSync(join(RAW_DIR, before), "utf8")) as { summary: Summary })
        .summary;
      const row = (name: string, x: number | null, y: number | null, unit = " s") =>
        `| ${name} | ${x === null ? "n/a" : `${s(x)}${unit}`} | ${y === null ? "n/a" : `${s(y)}${unit}`} |`;
      lines.push(
        "",
        `### Before and after (${b.at.slice(0, 10)} → ${at.slice(0, 10)})`,
        "",
        `| Measure | before | ${LABEL} |`,
        "|---|---:|---:|",
        row("Time to text, p50 (fresh)", b.textP50, sum.textP50),
        row("Time to text, p95 (fresh)", b.textP95, sum.textP95),
        row("Time to voice ready, p50 (fresh)", b.audioP50, sum.audioP50),
        row("Sample chip outcome, p50", b.chipOutcomeP50, sum.chipOutcomeP50),
        row("Sample chip outcome, slowest", b.chipOutcomeMax, sum.chipOutcomeMax),
        `| Sample chips cached or under 3 s | ${b.chipReplayed} of ${b.chipN} | ${sum.chipReplayed} of ${sum.chipN} |`,
        row(
          "Trace total, p50 (fresh)",
          b.stageP50.traceTotal ?? null,
          sum.stageP50.traceTotal ?? null,
        ),
      );
    }
  }
  if (!existsSync(OUT_MD)) writeFileSync(OUT_MD, "# Answer latency on the live site\n");
  appendFileSync(OUT_MD, `${lines.join("\n")}\n`);
});
