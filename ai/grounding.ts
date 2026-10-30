// Numbers are the specifics a teacher acts on (ten minutes, fifteen days). A step may only state a
// number its source states, and with the same thing counted: "10 minutes" is not grounded by
// "10 sticks". "one" is left out; it is mostly an article.

const EN_NUMBERS: Record<string, number> = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100,
};
const KN_DIGITS = "೦೧೨೩೪೫೬೭೮೯";
const HI_DIGITS = "०१२३४५६७८९";
/** Words after a number that are not what it counts. */
const NOT_UNITS = new Set(
  (
    "and or to of a an the in at for with by on from per more less other others another same " +
    "is are was were be been being has have had do does did will would can could should must may " +
    "already just only then so that this these those it its they them their he him his she her we " +
    "our you your my me all each every some any new small big little few many much very"
  ).split(" "),
);

function asciiDigits(text: string): string {
  return text.replace(/[\u0CE6-\u0CEF]/gu, (d) => String(KN_DIGITS.indexOf(d))).replace(/[\u0966-\u096F]/gu, (d) => String(HI_DIGITS.indexOf(d)));
}

export type NumberUse = { n: number; words: string[] };

const singular = (w: string) => w.replace(/s$/, "");

/**
 * A number in a sum or a range counts nothing by itself: "three plus four", "sums within ten", "up
 * to five". Its words after it are then not what it counts ("plus four, let them put" is not four
 * lets), so only the number itself must be grounded (v2, 24 Oct: the extractor lost two faithful
 * cards to this).
 */
const COUNTS_NOTHING_BEFORE = new Set(["plus", "minus", "add", "within", "till", "until", "upto", "below", "under", "beyond"]);
const COUNTS_NOTHING_AFTER = new Set(["plus", "minus"]);

/** Every number in the text with the content words among the three after it ("ten loose sticks" → 10 [loose, stick]). */
export function numberUses(text: string): NumberUse[] {
  const words = asciiDigits(text).toLowerCase().match(/\d+|[a-z]+/g) ?? [];
  const uses: NumberUse[] = [];
  words.forEach((w, i) => {
    const n = /^\d+$/.test(w) ? Number(w) : EN_NUMBERS[w];
    if (n === undefined || n < 2) return;
    const before = words[i - 1] ?? "";
    const upTo = before === "to" && words[i - 2] === "up";
    if (COUNTS_NOTHING_BEFORE.has(before) || upTo || COUNTS_NOTHING_AFTER.has(words[i + 1] ?? "")) {
      uses.push({ n, words: [] });
      return;
    }
    const after = words
      .slice(i + 1, i + 4)
      .filter((x) => !NOT_UNITS.has(x) && !(x in EN_NUMBERS) && !/^\d+$/.test(x))
      .map(singular);
    uses.push({ n, words: after });
  });
  return uses;
}

export function numbersIn(text: string): Set<number> {
  return new Set(numberUses(text).map((u) => u.n));
}

/**
 * Numbers the claim states that the source does not, or states counting something else.
 * Returns readable pieces for a retry message: "20", "10 minute".
 */
export function unsupportedNumbers(claim: string, source: string): string[] {
  const src = numberUses(source);
  const out: string[] = [];
  for (const u of numberUses(claim)) {
    const same = src.filter((x) => x.n === u.n);
    if (same.length === 0) {
      out.push(String(u.n));
      continue;
    }
    // The same number counting something else: no shared word after it in any use.
    const counted = same.filter((x) => x.words.length > 0);
    if (u.words.length && counted.length === same.length && !counted.some((x) => x.words.some((w) => u.words.includes(w)))) {
      out.push(`${u.n} ${u.words[0]}`);
    }
  }
  return [...new Set(out)];
}
