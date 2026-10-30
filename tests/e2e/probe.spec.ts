import { mkdirSync, writeFileSync } from "node:fs";
import { devices, expect, test, type Page } from "@playwright/test";

// Natural typed questions on a deployment (F-P2, 28 Oct): what a real teacher types, worded the way
// teachers word it (feelings first, Kannada and English mixed, "a child", never a name), asked as
// the one tap Sample teacher. It records which come back with "no master has answered this yet"
// and why: for an answered question the trace (what triage understood, how many cards the ranker
// considered, which it chose); for "no card", which shows no trace to the teacher, the topic and
// class triage gave it as the one tap Sample reviewer sees them in /r/queue.
//
//   PW_BASE_URL=https://parampara-eta.vercel.app pnpm exec playwright test --project=probe
//
// Spends real credits: every question is fresh (about 3 to 4 US cents answered, about 1 cent for
// "no card"). Spend guards: at most 15 questions, and asking stops at PROBE_MAX_USD (default 0.45).
// Raw rows go to docs/evals/probe/<stamp>.json; the reading is docs/evals/probe-2026-10-28.md.
test.skip(!process.env.PW_BASE_URL, "the probe runs against a deployment (PW_BASE_URL)");
test.describe.configure({ mode: "serial", timeout: 1_800_000 });
test.use({ actionTimeout: 20_000 });

const MAX = 15;
const MAX_USD = Number(process.env.PROBE_MAX_USD ?? 0.45);
const ONLY = (process.env.PROBE_ONLY ?? "").split(",").filter(Boolean);

/** What teachers actually type. "A child", never a name (Law 5). */
const PROBE_QUESTIONS = [
  {
    id: "p01",
    theme: "reluctant reader, tears",
    lang: "en",
    text: "A child in class 2 cannot read. The child cries when I ask him to read. What do I do?",
  },
  {
    id: "p02",
    theme: "reluctant reader, tears",
    lang: "kn",
    text: "ಎರಡನೇ ತರಗತಿಯ ಒಂದು ಮಗು ಓದು ಅಂದರೆ ಅಳುತ್ತದೆ, ಪುಸ್ತಕ ಮುಟ್ಟುವುದೇ ಇಲ್ಲ. ಏನು ಮಾಡಲಿ?",
  },
  {
    id: "p03",
    theme: "older weak reader, shame",
    lang: "en",
    text: "One child in my class 3 still reads like a class 1 child and feels ashamed in front of the others. How can I help without embarrassing him?",
  },
  {
    id: "p04",
    theme: "irregular attendance",
    lang: "kn",
    text: "ನನ್ನ class ನಲ್ಲಿ ಒಂದು ಮಗು ವಾರಕ್ಕೆ ಎರಡು ದಿನ ಮಾತ್ರ ಬರುತ್ತದೆ. ಉಳಿದವರಿಗಿಂತ ಹಿಂದೆ ಬೀಳದಂತೆ ಹೇಗೆ ನೋಡಿಕೊಳ್ಳಲಿ?",
  },
  {
    id: "p05",
    theme: "long absence, forgot letters",
    lang: "en",
    text: "A child was away three weeks for the harvest and has forgotten the letters she knew. How do I help her catch up?",
  },
  {
    id: "p06",
    theme: "multigrade, alone",
    lang: "en",
    text: "I teach class 1, 2 and 3 together and I am alone. Class 1 needs me all the time. How do I keep the others learning?",
  },
  {
    id: "p07",
    theme: "multigrade maths",
    lang: "kn",
    text: "ಒಂದೇ ಕೋಣೆಯಲ್ಲಿ ಮೂರು ತರಗತಿ, ನಾನೊಬ್ಬಳೇ ಶಿಕ್ಷಕಿ. ಮೂರಕ್ಕೂ ಒಟ್ಟಿಗೆ ಗಣಿತ ಹೇಗೆ ಮಾಡಿಸಲಿ?",
  },
  {
    id: "p08",
    theme: "counting objects",
    lang: "en",
    text: "My class 1 children say numbers up to 20, but when I ask for 7 stones they bring any handful. What should I do?",
  },
  {
    id: "p09",
    theme: "place value",
    lang: "kn",
    text: "ಮಕ್ಕಳಿಗೆ ಹತ್ತು ಮತ್ತು ಬಿಡಿ ಅರ್ಥ ಆಗುತ್ತಿಲ್ಲ. 23 ಅಂದರೆ ಎರಡು ಹತ್ತು ಮೂರು ಬಿಡಿ ಅಂತ ಗೊತ್ತಿಲ್ಲ. ಹೇಗೆ ಕಲಿಸಲಿ?",
  },
  {
    id: "p10",
    theme: "spelling in own writing",
    lang: "en",
    text: "My class 2 children copy well from the board, but when they write on their own the spelling is full of mistakes.",
  },
  {
    id: "p11",
    theme: "reluctant writers",
    lang: "kn",
    text: "ಮಕ್ಕಳು ಬರೆಯೋಕೆ ಇಷ್ಟಪಡಲ್ಲ. ಬರೆಯಿರಿ ಅಂದರೆ ಪೆನ್ಸಿಲ್ ಹಿಡಿದು ಸುಮ್ಮನೆ ಕೂರುತ್ತಾರೆ. ಏನು ಮಾಡಲಿ?",
  },
  {
    id: "p12",
    theme: "parents and attendance",
    lang: "en",
    text: "Parents do not send their children to school regularly. How do I talk to them?",
  },
  {
    id: "p13",
    theme: "fear of maths",
    lang: "kn",
    text: "A child is very scared of maths and starts crying when I give sums. ಏನು ಮಾಡಲಿ?",
  },
  {
    id: "p14",
    theme: "crying at the gate",
    lang: "en",
    text: "A child in class 1 does not want to come to school and cries every morning at the gate. How do I make school feel safe for her?",
  },
  {
    id: "p15",
    theme: "fights in class",
    lang: "en",
    text: "Two children in my class 2 quarrel every day and disturb everyone. How can I calm the class?",
  },
] as const;

type Row = {
  id: string;
  theme: string;
  lang: string;
  text: string;
  outcome: string;
  seconds: number;
  /** From the trace (answered only): "topic · grade · intent". */
  understood: string | null;
  /** From the trace (answered only): "n of m considered (k approved)". */
  retrieval: string | null;
  /** The card ids the answer's steps cite (mapped to Sample card ids in the report). */
  cards: string[];
  /** From /r/queue (no card): the topic and class chips. */
  queueTopic: string | null;
  usd: number | null;
};

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}

async function readTrace(page: Page) {
  const button = page
    .getByRole("button", { name: /How this answer was made|ಈ ಉತ್ತರ ಹೇಗೆ ತಯಾರಾಯಿತು/ })
    .filter({ visible: true })
    .first();
  if (!(await button.count())) return { understood: null, retrieval: null, usd: null };
  await button.click();
  await page
    .locator("li[data-kind]")
    .first()
    .waitFor({ timeout: 15_000 })
    .catch(() => {});
  const items = await page.$$eval("li[data-kind]", (lis) =>
    lis.map((li) => ({ kind: li.getAttribute("data-kind"), text: li.textContent ?? "" })),
  );
  const pick = (kind: string, re: RegExp) => {
    const t = items.find((i) => i.kind === kind)?.text ?? "";
    return re.exec(t)?.[0] ?? null;
  };
  const total = await page
    .getByText(/^(Total|ಒಟ್ಟು)/)
    .filter({ visible: true })
    .first()
    .locator("xpath=..")
    .innerText()
    .catch(() => "");
  const usd = /\$([\d.]+)/.exec(total);
  await page.keyboard.press("Escape").catch(() => {});
  return {
    understood: pick(
      "triage",
      /[a-z_]+ · [^·]+ · (pedagogy|safety_disclosure|teacher_distress|off_topic|greeting|other)/,
    ),
    retrieval: pick("retrieval", /\d+ of \d+ considered \(\d+ approved\)/),
    usd: usd ? Number(usd[1]) : null,
  };
}

test("probe: natural typed questions as the one tap Sample teacher", async ({ browser }) => {
  const questions = PROBE_QUESTIONS.filter((q) => !ONLY.length || ONLY.includes(q.id));
  expect(questions.length).toBeLessThanOrEqual(MAX);
  const context = await browser.newContext({ ...devices["Pixel 7"], serviceWorkers: "block" });
  const page = await context.newPage();
  await open(page, "/?lang=en");
  await page.locator('form[data-door="teacher"] button[type="submit"]').click();
  await expect(page.getByLabel("Signed in")).toBeVisible({ timeout: 60_000 });

  const rows: Row[] = [];
  let spent = 0;
  for (const q of questions) {
    if (spent >= MAX_USD) {
      console.warn(`[probe] stopped: about $${spent.toFixed(3)} spent (cap $${MAX_USD})`);
      break;
    }
    await open(page, `/t/ask?lang=${q.lang}`);
    await page
      .getByRole("button", { name: /Type it instead|ಬರೆದು ಕೇಳಿ/ })
      .filter({ visible: true })
      .first()
      .click();
    await page.locator("textarea").filter({ visible: true }).first().fill(q.text);
    const started = Date.now();
    await page.locator("form button[type=submit]").filter({ visible: true }).first().click();
    const answer = page
      .waitForURL(/\/t\/a\/[0-9a-f-]{36}$/, { timeout: 120_000 })
      .then(() => "answered");
    const panel = page
      .locator('[data-testid^="outcome-"]')
      .first()
      .waitFor({ timeout: 120_000 })
      .then(async () =>
        (
          (await page.locator('[data-testid^="outcome-"]').first().getAttribute("data-testid")) ??
          ""
        ).replace("outcome-", ""),
      );
    const outcome = await Promise.race([answer, panel]).catch(() => "timeout");
    const seconds = Math.round((Date.now() - started) / 100) / 10;
    const row: Row = {
      id: q.id,
      theme: q.theme,
      lang: q.lang,
      text: q.text,
      outcome,
      seconds,
      understood: null,
      retrieval: null,
      cards: [],
      queueTopic: null,
      usd: null,
    };
    if (outcome === "answered") {
      await page.locator("li[data-card]").first().waitFor({ timeout: 30_000 });
      const t = await readTrace(page);
      row.understood = t.understood;
      row.retrieval = t.retrieval;
      row.usd = t.usd;
      row.cards = [
        ...new Set(
          await page.$$eval("li[data-card]", (lis) =>
            lis.map((li) => li.getAttribute("data-card") ?? ""),
          ),
        ),
      ];
    }
    spent += row.usd ?? (outcome === "answered" ? 0.04 : 0.012);
    rows.push(row);
    console.log(`[probe] ${q.id} ${outcome} ${seconds}s ${row.understood ?? ""}`);
  }
  await context.close();

  // "No card" shows no trace to the teacher: read what triage gave it as the Sample reviewer sees it.
  const gaps = rows.filter((r) => r.outcome === "no-card");
  if (gaps.length) {
    const rc = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const rp = await rc.newPage();
    await open(rp, "/?lang=en");
    await rp.locator('form[data-door="reviewer"] button[type="submit"]').click();
    await expect(rp.getByLabel("Signed in")).toBeVisible({ timeout: 60_000 });
    await open(rp, "/r/queue?lang=en");
    for (const r of gaps) {
      const li = rp
        .locator("li[data-queue-row]")
        .filter({ hasText: r.text.slice(0, 40) })
        .first();
      if (!(await li.count())) continue;
      const chips = await li.locator("span.rounded-chip").allInnerTexts();
      r.queueTopic =
        chips.filter((c) => !/No card|Urgent|Sample|Field/i.test(c)).join(" · ") || null;
    }
    await rc.close();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  mkdirSync("docs/evals/probe", { recursive: true });
  writeFileSync(
    `docs/evals/probe/${stamp}.json`,
    JSON.stringify(
      { base: process.env.PW_BASE_URL, at: new Date().toISOString(), spent, rows },
      null,
      2,
    ),
  );
  console.log(
    rows
      .map(
        (r) =>
          `${r.id} | ${r.lang} | ${r.outcome} | ${r.seconds}s | ${r.understood ?? r.queueTopic ?? ""} | ${r.retrieval ?? ""} | ${r.cards.join(" / ")}`,
      )
      .join("\n"),
  );
  console.log(`[probe] about $${spent.toFixed(3)} spent`);
});
