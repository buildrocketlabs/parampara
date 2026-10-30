// Child name heuristics (Law 5). The redactor model is the real defence; these catch the most
// common ways a child is introduced by name in spoken Kannada and English, so a model slip is
// retried instead of stored. They look only for names introduced as a child's, which keeps them
// precise enough to block on: "ರವಿ ಅಂತ ಒಬ್ಬ ಹುಡುಗ", "ಲಕ್ಷ್ಮಿ ಅನ್ನೋ ಹುಡುಗಿ", "ಅವನ ಹೆಸರು ರವಿ.",
// "a boy named Ravi", "a girl, Priya,", "Priya ಅಂತ ಒಂದು girl". A name the model leaves in another
// script ("Ravi" for ರವಿ) is caught by its phonetic key.

const K = "\\u0C80-\\u0CFF";
/** Devanagari letters and signs, without the danda punctuation. */
const D = "\\u0900-\\u0963\\u0966-\\u097F";
const HI_WORD = `[${D}]{2,}`;
const KN_WORD = `[${K}]{2,}`;
const LATIN_NAME = "[A-Z][a-z]{2,}";
const CHILD_NOUN = "(?:ಹುಡುಗ|ಹುಡುಗಿ|ಹುಡ್ಗ|ಹುಡ್ಗಿ|ಮಗು|ವಿದ್ಯಾರ್ಥಿ|ಹೈದ|girl|boy|child|student|kid)";
const CHILD_NOUN_EN = "(?:boy|girl|child|student|pupil|kid|son|daughter)";

/** Zero width characters and soft hyphens can split a word so a pattern misses it. */
const INVISIBLE = /[\u200B-\u200D\u2060\u00AD\uFEFF]/g;

/** NFC, no invisible characters, long and short ii and uu treated alike (ಲಕ್ಷ್ಮೀ = ಲಕ್ಷ್ಮಿ). */
export function normalizeText(s: string): string {
  return s.normalize("NFC").replace(INVISIBLE, "").replace(/\u0CC0/g, "\u0CBF").replace(/\u0CC2/g, "\u0CC1");
}

/** Words that can sit where a name would, but are not names. */
const NOT_NAMES = new Set([
  "ಒಂದು", "ಆ", "ಈ", "ಮಗು", "ಒಬ್ಬ", "ಒಬ್ಬಳು", "ಯಾರೋ", "ಹೀಗೆ", "ಹಾಗೆ", "ಏನೋ", "ಏನು", "ಇನ್ನೊಂದು", "ಬೇರೆ",
  "ಹೊಸ", "ಸಣ್ಣ", "ಚಿಕ್ಕ", "ದೊಡ್ಡ", "ಅಪ್ಪ", "ಅಮ್ಮ", "ಅಜ್ಜ", "ಅಜ್ಜಿ", "ಅಣ್ಣ", "ಅಕ್ಕ", "ತಮ್ಮ", "ತಂಗಿ",
  "ಬೋರ್ಡ್", "ಸ್ಲೇಟ್", "ಪುಸ್ತಕ", "ಕಾರ್ಡ್", "ಕಾಗದ", "ನೋಟ್ಬುಕ್",
  "The", "This", "That", "One", "Another",
  "out", "him", "her", "them", "me", "us", "the", "for", "back", "up", "in", "on", "after", "by",
  "बताना", "नहीं", "याद", "क्या", "एक", "यह", "वह",
]);
/** After ಹೆಸರು (name) these say the name is withheld or forgotten, not given. */
const WITHHELD = /^(?:ಹೇಳ|ಬೇಡ|ನೆನಪ|ಗೊತ್ತ|ಮರೆತ|ಏನ|ಯಾಕೆ|ಬಿಡ|ಬೇಕ|ಹಾಕ|ಬರೆ|ಕರೆ|ಇಲ್ಲ|ಕೇಳ|ಒಂದು|ಆ$|ಈ$|ಹೇಳ್)/u;
/** The name ends the clause: "ಅವನ ಹೆಸರು ರವಿ." not "ಮಗುವಿನ ಹೆಸರು ಬೋರ್ಡ್ ಮೇಲೆ ಬರೆಯಿರಿ". */
const CLAUSE_END = "(?=\\s*(?:$|[,.!?।]|ಅಂತ|ಅಂತಾ|ಎಂದು))";

const PATTERNS: RegExp[] = [
  // ರವಿ ಅಂತ ಒಬ್ಬ ಹುಡುಗ · Priya ಅಂತ ಒಂದು girl
  new RegExp(`(?<![${K}A-Za-z])(${KN_WORD}|${LATIN_NAME})\\s+(?:ಅಂತ|ಅಂತಾ|ಎಂಬ|ಎನ್ನುವ|ಅನ್ನೋ|ಅನ್ನುವ)\\s+(?:ಒಬ್ಬ|ಒಬ್ಬಳು|ಒಂದು)\\s+${CHILD_NOUN}`, "gu"),
  // ರವಿ ಅಂತ ಹುಡುಗ ಇದ್ದ (the quotative ಅಂತ also means "saying", so only with "there was")
  new RegExp(`(?<![${K}A-Za-z])(${KN_WORD})\\s+(?:ಅಂತ|ಅಂತಾ)\\s+(?:ಹುಡುಗ|ಹುಡುಗಿ|ಮಗು|ಹುಡ್ಗ|ಹುಡ್ಗಿ)\\s+(?:ಇದ್ದ|ಇದ್ಲು|ಇದ್ದಳು|ಇತ್ತು|ಇದ್ದನು)`, "gu"),
  // ಲಕ್ಷ್ಮಿ ಅನ್ನೋ ಹುಡುಗಿ · ರವಿ ಎಂಬ ವಿದ್ಯಾರ್ಥಿ
  new RegExp(`(?<![${K}A-Za-z])(${KN_WORD}|${LATIN_NAME})\\s+(?:ಎಂಬ|ಎನ್ನುವ|ಅನ್ನೋ|ಅನ್ನುವ|ಹೆಸರಿನ)\\s+${CHILD_NOUN}`, "gu"),
  // ಅವನ ಹೆಸರು ರವಿ · ಆ ಹುಡುಗಿಯ ಹೆಸರು ಲಕ್ಷ್ಮಿ
  new RegExp(`(?:ಅವನ|ಅವಳ|ಮಗುವಿನ|ಹುಡುಗನ|ಹುಡುಗಿಯ|ಹುಡ್ಗನ|ಹುಡ್ಗಿ|ವಿದ್ಯಾರ್ಥಿಯ)\\s+ಹೆಸರು\\s+(${KN_WORD}|${LATIN_NAME})${CLAUSE_END}`, "gu"),
  // a boy named Ravi · a girl called priya (speech to text may lower case it)
  new RegExp(`\\b${CHILD_NOUN_EN}\\s+(?:named|called|nicknamed)\\s+["']?([A-Za-z][a-z]{2,})`, "giu"),
  // a boy, Ravi, was ...
  new RegExp(`\\b${CHILD_NOUN_EN},\\s+(${LATIN_NAME}),`, "gu"),
  // राहुल नाम का एक लड़का · उसका नाम राहुल है
  new RegExp(`(?<![${D}])(${HI_WORD})\\s+नाम\\s+(?:का|की|के)\\s+(?:एक\\s+)?(?:लड़का|लड़की|बच्चा|बच्ची|छात्र|छात्रा)`, "gu"),
  new RegExp(`(?:उसका|उसकी|बच्चे का|बच्ची का|लड़के का|लड़की का)\\s+नाम\\s+(${HI_WORD})(?=\\s*(?:$|[,.!?।]|है|था|थी))`, "gu"),
  // his name was Ravi
  new RegExp(`\\b(?:[Hh]is|[Hh]er|[Tt]he child's|[Tt]he boy's|[Tt]he girl's)\\s+name\\s+(?:is|was)\\s+["']?(${LATIN_NAME})`, "gu"),
];

function isPlaceholder(word: string): boolean {
  return NOT_NAMES.has(word) || NOT_NAMES.has(word.toLowerCase()) || WITHHELD.test(word);
}

/** Names the text introduces as a child's. Used on input, to check the output no longer has them. */
export function childNameCandidates(text: string): string[] {
  const clean = normalizeText(text);
  const found = new Set<string>();
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (const m of clean.matchAll(re)) {
      const name = m[1];
      if (name && !isPlaceholder(name)) found.add(name);
    }
  }
  return [...found];
}

/** True when the text still introduces a child by name. Never returns the name itself. */
export function hasChildNamePattern(text: string): boolean {
  return childNameCandidates(text).length > 0;
}

const KN_CASE_SUFFIX =
  "(?:ಯ|ಯನ್ನು|ಯನ್ನ|ಗೆ|ಯಿಗೆ|ಗ|ನ|ನನ್ನು|ನನ್ನ|ನಿಗೆ|ಳ|ಳನ್ನು|ಳನ್ನ|ಳಿಗೆ|ಯಿಂದ|ನಿಂದ|ಳಿಂದ|ಗೂ|ಯೂ|ನೂ|ಳೂ|ದು|ಅವರ|ಅವರು|ಗಿಂತ|ಯಲ್ಲಿ|ನಲ್ಲಿ|ಳಲ್ಲಿ|ಯೊಂದಿಗೆ|ನೊಂದಿಗೆ|ಳೊಂದಿಗೆ|ಯು|ನು|ಳು|ಯೇ|ನೇ|ಳೇ|ಗಾಗಿ|ಯಂತೆ|ನಂತೆ|ಳಂತೆ|ಯಲ್ಲೇ|ಗೇ)?";

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Phonetic key: one name across Kannada and Latin script ──────────────────
// Consonants only, aspiration and length dropped, so ರವಿ, Ravi, ravi and Ravee share "rv", and
// ಲಕ್ಷ್ಮಿ, Lakshmi and Laxmi share "lksm".
const KN_CONSONANT: Record<string, string> = {
  ಕ: "k", ಖ: "k", ಗ: "g", ಘ: "g", ಙ: "n", ಚ: "c", ಛ: "c", ಜ: "j", ಝ: "j", ಞ: "n",
  ಟ: "t", ಠ: "t", ಡ: "d", ಢ: "d", ಣ: "n", ತ: "t", ಥ: "t", ದ: "d", ಧ: "d", ನ: "n",
  ಪ: "p", ಫ: "p", ಬ: "b", ಭ: "b", ಮ: "m", ಯ: "y", ರ: "r", ಱ: "r", ಲ: "l", ವ: "v",
  ಶ: "s", ಷ: "s", ಸ: "s", ಹ: "h", ಳ: "l", ೞ: "l", "ಂ": "n",
};

function collapse(s: string): string {
  return s.replace(/(.)\1+/g, "$1");
}

export function phoneticKey(word: string): string {
  const w = normalizeText(word);
  if (new RegExp(`[${K}]`, "u").test(w)) {
    return collapse([...w].map((ch) => KN_CONSONANT[ch] ?? "").join(""));
  }
  let s = w.toLowerCase().replace(/[^a-z]/g, "");
  s = s
    .replace(/x/g, "ks")
    .replace(/ch/g, "1")
    .replace(/c/g, "k")
    .replace(/1/g, "c")
    .replace(/sh/g, "s")
    .replace(/([kgtdpbjc])h/g, "$1")
    .replace(/q/g, "k")
    .replace(/f/g, "p")
    .replace(/w/g, "v")
    .replace(/z/g, "j")
    .replace(/[aeiou]/g, "");
  return collapse(s);
}

/** The first sound: a vowel ("V") or the first consonant's key letter. */
function initialSound(word: string): string {
  const w = normalizeText(word);
  const first = w[0] ?? "";
  if (/[\u0C85-\u0C94]/u.test(first) || /[aeiou]/i.test(first)) return "V";
  return phoneticKey(w)[0] ?? "";
}

/** Does `name` appear in `text` as a word, in either script, with Kannada case endings? */
export function mentionsName(text: string, name: string): boolean {
  const t = normalizeText(text);
  const n = normalizeText(name);
  const isKn = new RegExp(`[${K}]`, "u").test(n);
  if (new RegExp(`[${D}]`, "u").test(n)) {
    // Hindi case markers are separate words (राहुल को, राहुल का), so a whole word match is enough.
    return new RegExp(`(?<![${D}])${escape(n)}(?![${D}])`, "u").test(t);
  }
  const direct = isKn
    ? new RegExp(`(?<![${K}])${escape(n)}${KN_CASE_SUFFIX}(?![${K}])`, "u")
    : new RegExp(`\\b${escape(n)}(?:'s)?\\b`, "iu");
  if (direct.test(t)) return true;
  const key = phoneticKey(n);
  if (key.length < 2) return false;
  const initial = initialSound(n);
  // The other script: Latin words for a Kannada name, Kannada words for a Latin one.
  const words = isKn ? t.match(/[A-Za-z]{3,}/g) ?? [] : t.match(new RegExp(`[${K}]{2,}`, "gu")) ?? [];
  return words.some((w) => {
    if (initialSound(w) !== initial) return false;
    const wk = phoneticKey(w);
    if (wk === key) return true;
    // A Kannada word can carry a case ending: ಪ್ರಿಯಾಗೆ is "pryg", Priya is "pry".
    return !isKn && wk.startsWith(key) && wk.length - key.length <= 2 && w.length > n.length;
  });
}

// ── A name said bare, in a plain sentence (24 Oct) ──────────────────────────
// "Ravi in my class does not speak": no introduction for the patterns above to find. Two narrow
// signals, so blocking on them stays rare: a list of common first names that are nothing else,
// and, only to check an answer against the question, a capitalised Latin word that is not an
// ordinary English or school word.

/**
 * Common first names of Karnataka's children: Kannada spelling first, then usual Latin spellings.
 * Never a god's, a river's, a month's, a Sample master's, a brand's or an everyday word's (ಮಂಜು is
 * fog, ಕಿರಣ a ray, ಆಶಾ the ASHA worker, ನಂದಿನಿ the milk, ರಾಣಿ a queen, puja a prayer), so a hit is a
 * person's name. ಅರ್ಜುನ and ಮಂಜುನಾಥ are also a hero and a deity, but far more often a child.
 */
const COMMON_NAMES: ReadonlyArray<readonly [string, ...string[]]> = [
  ["ರಮೇಶ", "ramesh"], ["ಸುರೇಶ", "suresh"], ["ಮಹೇಶ", "mahesh"], ["ಗಿರೀಶ", "girish"], ["ಸತೀಶ", "satish", "sathish"],
  ["ರಾಜು", "raju"], ["ರವಿ", "ravi"], ["ಅರುಣ", "arun"], ["ಸಂದೀಪ", "sandeep", "sandip"], ["ಸುನೀಲ", "sunil"],
  ["ರಾಹುಲ", "rahul"], ["ರೋಹಿತ", "rohit", "rohith"], ["ಅಮಿತ", "amit"], ["ಸಚಿನ", "sachin"], ["ಅಜಯ", "ajay"],
  ["ಶಿವು", "shivu"], ["ಬಸವರಾಜ", "basavaraj"], ["ನಾಗರಾಜ", "nagaraj"], ["ಹರೀಶ", "harish"], ["ಯಶವಂತ", "yashwanth", "yashwant"],
  ["ಲೋಕೇಶ", "lokesh"], ["ಯೋಗೇಶ", "yogesh"], ["ಉಮೇಶ", "umesh"], ["ದಿನೇಶ", "dinesh"], ["ಸಿದ್ದು", "siddu"],
  ["ಶಿವಕುಮಾರ", "shivakumar"], ["ಅರ್ಜುನ", "arjun"], ["ಮಂಜುನಾಥ್", "manjunath"], ["ಇಮ್ರಾನ", "imran"], ["ಅಬ್ದುಲ", "abdul"],
  ["ಸಲ್ಮಾನ", "salman"], ["ಲಕ್ಷ್ಮಿ", "lakshmi", "laxmi"], ["ಪ್ರಿಯಾ", "priya"], ["ಕಾವ್ಯಾ", "kavya"], ["ಅನಿತಾ", "anitha", "anita"],
  ["ಸುನೀತಾ", "sunitha", "sunita"], ["ರೇಖಾ", "rekha"], ["ಪೂಜಾ"], ["ದೀಪಾ", "deepa"], ["ಶ್ವೇತಾ", "shwetha", "shweta"],
  ["ಸುಮಾ", "suma"], ["ರಮ್ಯಾ", "ramya"], ["ಅಂಜಲಿ", "anjali"], ["ಅನುಷಾ", "anusha"], ["ಸಂಗೀತಾ", "sangeetha", "sangeeta"],
  ["ಮೇಘನಾ", "meghana"], ["ಶಿಲ್ಪಾ", "shilpa"], ["ಸಹನಾ", "sahana"], ["ಹರ್ಷಿತಾ", "harshitha", "harshita"], ["ಕೀರ್ತನಾ", "keerthana"],
  ["ಅರ್ಪಿತಾ", "arpitha", "arpita"], ["ಹೀನಾ", "heena", "hina"], ["ಸಾನಿಯಾ", "saniya", "sania"], ["ಫಾತಿಮಾ", "fathima", "fatima"],
  ["ಆಯೇಷಾ", "ayesha"], ["ಶೋಭಾ", "shobha"], ["ಮೀನಾ", "meena"],
];

/** Long vowels spelled either way: Laxmee is Laxmi, Pooja is Puja. */
const latinVowels = (w: string) => w.toLowerCase().replace(/ee/g, "i").replace(/oo/g, "u");

/**
 * Is the Latin word one of the listed spellings? Long vowels either way, and a name ending in a
 * consonant may carry a final a (Ramesha, Manjunatha, Nagaraja). Never the other way round, so
 * "deep" is not Deepa.
 */
function isListedSpelling(word: string, spellings: readonly string[]): boolean {
  const w = latinVowels(word);
  return spellings.some((s) => {
    const n = latinVowels(s);
    return w === n || (/[^aeiou]$/.test(n) && w === `${n}a`);
  });
}

/** The list names in the text: Kannada with its case endings, or a Latin spelling as a whole word. */
export function commonNamesIn(text: string): string[] {
  const t = normalizeText(text);
  const latin = [...new Set(t.match(/[A-Za-z]+/g) ?? [])];
  const found: string[] = [];
  for (const [kn, ...spellings] of COMMON_NAMES) {
    const n = normalizeText(kn).replace(/್$/u, "");
    const inKn = new RegExp(`(?<![${K}])${escape(n)}್?${KN_CASE_SUFFIX}(?![${K}])`, "u").test(t);
    if (inKn || latin.some((w) => isListedSpelling(w, spellings))) found.push(kn);
  }
  return found;
}

/**
 * Lower case words a capitalised word may be without being a name: English words a sentence may
 * start with, school words, subjects, languages, days, months, festivals and places.
 */
const ORDINARY_EN = new Set(
  (
    "the a an and or but if so then than that this these those there here what which who whom whose why how when where " +
    "is are was were be been am do does did have has had can could should would will shall may might must not no yes " +
    "i me my mine we us our you your he him his she her it its they them their one two three four five six seven eight " +
    "nine ten some any all every each many much more most few other another such same own only just also even still " +
    "please hello hi namaskara namaste dear thank thanks sorry okay ok good great very really now today tomorrow yesterday " +
    "after before during while since until because though although about above below under over into onto from with " +
    "without for of on in at by to up down out off again once twice first second third last next new old " +
    "children child kids kid students student pupils pupil boys boy girls girl parents parent mother father teacher " +
    "teachers class classes classroom school schools headmaster headmistress sir madam maam mam miss mr mrs ms " +
    "reading writing letters letter words word numbers number counting maths math mathematics english kannada hindi " +
    "evs science homework lesson lessons story stories song songs game games sticks stones slate slates chalk board " +
    "blackboard book books notebook period morning evening afternoon night day days week weeks month months year years " +
    "monday tuesday wednesday thursday friday saturday sunday january february march april june july august " +
    "september october november december diwali deepavali dasara dussehra ugadi sankranti ramzan ramadan eid christmas " +
    "karnataka bengaluru bangalore mysuru mysore koppal dharwad hubli hubballi belagavi kalaburagi raichur ballari " +
    "vijayapura bidar haveri gadag tumakuru mandya hassan shivamogga udupi mangaluru india indian " +
    "lambani urdu tamil telugu marathi konkani tulu kodava banjara " +
    "fourteen fifteen sixteen twenty thirty hundred " +
    "give make let help tell ask show teach try use start stop keep put take bring read write say speak sing draw count " +
    "should what's how's i'm i've don't can't won't isn't doesn't didn't " +
    "fln nipun anganwadi asha mid meal lunch breakfast grade standard std " +
    "phonics grammar vocabulary alphabet abacus worksheet worksheets flashcards rhymes rhyme poem poems"
  ).split(" "),
);

/**
 * Capitalised Latin words in the middle of a sentence that are not ordinary or school words: in
 * "My student Kavitha cannot read", Kavitha. A word capitalised only because it starts a sentence
 * ("Always", "Sometimes") is not counted; a name said only there is left to the list above.
 */
function latinProperNouns(text: string): string[] {
  const t = normalizeText(text);
  const found = new Set<string>();
  for (const m of t.matchAll(/\b[A-Z][a-z]{2,}\b/g)) {
    const before = t.slice(0, m.index).trimEnd();
    const startsSentence = before === "" || /[.!?\[(:;"'“‘\n]$/u.test(before);
    if (!startsSentence && !ORDINARY_EN.has(m[0].toLowerCase())) found.add(m[0]);
  }
  return [...found];
}

/**
 * How many names from her question an answer repeats that its own sources (the cards) never say.
 * A person named in the question, introduced or bare, must never reach an answer (Law 5); a word
 * the cards themselves use is the practice's, not a person's. Returns a count, never the names.
 */
export function namesEchoed(question: string, answer: string, sources: string): number {
  return nameEchoCheck(question)(answer, sources);
}

/**
 * The same check, made while her raw words are still at hand: it keeps only the possible names,
 * so the pipeline can let the raw question go after triage and still check the answer later.
 */
export function nameEchoCheck(question: string): (answer: string, sources: string) => number {
  // Listed names are matched exactly, never by sound: Suma is not "same", Deepa is not "deep".
  const listed = commonNamesIn(question);
  const others = [...new Set([...childNameCandidates(question), ...latinProperNouns(question)])].filter(
    (n) => !listed.some((l) => sameListedName(l, n)),
  );
  return (answer, sources) => {
    const inAnswer = commonNamesIn(answer);
    const inSources = commonNamesIn(sources);
    const listedHits = listed.filter((n) => inAnswer.includes(n) && !inSources.includes(n));
    const otherHits = others.filter(
      (n) => mentionsCloselyAsName(answer, n) && !saysWord(sources, n),
    );
    return listedHits.length + otherHits.length;
  };
}

/** Is `word` one of the spellings of the listed name `kn`? */
function sameListedName(kn: string, word: string): boolean {
  const entry = COMMON_NAMES.find(([k]) => k === kn);
  return !!entry && (normalizeText(word).startsWith(normalizeText(kn).replace(/್$/u, "")) || isListedSpelling(word, entry.slice(1)));
}

/** The exact word (with Kannada case endings), never a word that only sounds like it. */
function saysWord(text: string, word: string): boolean {
  const t = normalizeText(text);
  const w = normalizeText(word);
  return new RegExp(`[${K}]`, "u").test(w)
    ? new RegExp(`(?<![${K}])${escape(w.replace(/್$/u, ""))}್?${KN_CASE_SUFFIX}(?![${K}])`, "u").test(t)
    : new RegExp(`\\b${escape(w)}\\b`, "iu").test(t);
}

/**
 * The answer uses the word as a name: the word itself (a Latin word only capitalised; one the
 * answer also writes in lower case is an ordinary word, "Always" and "always"), or, for a name of
 * three or more consonants, the same name in the other script. Two consonant keys are too loose
 * across scripts (ಸುಮಾ and "same").
 */
function mentionsCloselyAsName(answer: string, word: string): boolean {
  const t = normalizeText(answer);
  const w = normalizeText(word);
  const isLatin = /^[A-Za-z]+$/.test(w);
  if (isLatin && new RegExp(`\\b${escape(w.toLowerCase())}\\b`, "u").test(t)) return false;
  if (isLatin ? new RegExp(`\\b${escape(w)}(?:'s)?\\b`, "u").test(t) : saysWord(t, w)) return true;
  return phoneticKey(w).length >= 3 && mentionsName(t, w);
}
