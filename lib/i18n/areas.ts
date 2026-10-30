import type { Lang, MessageKey } from "./index";
import { messages } from "./messages";
import type { Strings } from "./provider";

// Which strings each part of the app sends to the browser (DESIGN §10: first load JS under 200 KB).
// kn.ts and en.ts stay the only source of copy. Server code reads the whole dictionary; client
// components read only what their route's provider holds: the root layout passes `core`, and each
// role's layout (or page) adds its own area, in both languages, so the toggle needs no round trip.
// lib/i18n/areas.test.ts scans every component a route renders and fails on a key outside its
// areas' prefixes, and on keys built at run time that are not listed in DYNAMIC_KEYS below.

/** Key prefixes per area. A prefix ending in "." covers a namespace; otherwise a single key. */
export const AREAS = {
  // Everything the root layout renders (feedback, offline, toasts, errors), plus the pieces every
  // room shares: sign in and room doors, the session bar, stages, badges, empty and error states.
  core: [
    "app.",
    "lang.",
    "hanate.",
    "badge.",
    "offline.",
    "error.",
    "notfound.",
    "loading.",
    "toast.",
    "sheet.",
    "feedback.",
    "celebrate.",
    "sound.",
    "state.",
    "loader.",
    "empty.",
    "card.",
    "master.",
    "room.",
    "door.",
    "session.",
    "login.",
    "stage.",
    "mic.",
    "chip.",
    "review.sign_in",
    "tried.welfare.",
    "tried.note.count",
    "tried.sending",
    "ask.childline",
    "ask.telemanas",
  ],
  teacher: [
    "ask.",
    "tried.",
    "trace.",
    "answer.",
    "voice.",
    "share.",
    "home.",
    "pwa.",
    "review.card.",
  ],
  master: ["talk.", "import.", "mhome.", "transcript.", "voice.", "welcome."],
  review: [
    "review.",
    "invites.",
    "rhub.",
    "queue.",
    "share.",
    "voice.",
    "transcript.",
    "trace.",
    "answer.",
  ],
  officer: ["pulse.", "lamps.", "rhub."],
  public: [
    "hero.",
    "doors.",
    "how.",
    "promise.",
    "footer.",
    "enter.",
    "join.",
    "welcome.",
    "consent.",
    "invites.",
    "pwa.",
    "trace.",
    "answer.",
  ],
  // /how: the page itself and its field test panel, with the outcome words and week line it borrows.
  how: [
    "howpage.",
    "field.",
    "pulse.fewer.cap",
    "pulse.week",
    "tried.worked",
    "tried.partly",
    "tried.didnt",
  ],
  // The design gallery's own captions; the gallery also carries every other area.
  design: ["design."],
} as const satisfies Record<string, readonly string[]>;

export type Area = keyof typeof AREAS;
const ALL_AREAS = (Object.keys(AREAS) as Area[]).filter((a) => a !== "core");

/**
 * The areas each route folder adds to `core` (single source for the layouts and the test). The
 * design gallery shows every component, so it carries everything.
 */
export const ROUTE_AREAS = {
  "app/page.tsx": ["public"],
  "app/t": ["teacher"],
  "app/m": ["master"],
  "app/r": ["review"],
  "app/i": ["officer"],
  "app/how": ["public", "how"],
  "app/login": ["public"],
  "app/join": ["public"],
  "app/welcome": ["public"],
  "app/offline": ["public"],
  "app/design": ALL_AREAS,
} as const satisfies Record<string, readonly Area[]>;

export type AreaRoute = keyof typeof ROUTE_AREAS;

/**
 * Keys a client component builds at run time (a template or a lookup the scan cannot read), with
 * the prefix they stay inside and why. The area test fails on any other run time key.
 */
export const DYNAMIC_KEYS: ReadonlyArray<{ file: string; prefix: string; why: string }> = [
  {
    file: "app/t/page.tsx",
    prefix: "home.greeting.",
    why: "the greeting follows the part of the day",
  },
  {
    file: "components/teacher/AskFlow.tsx",
    prefix: "ask.sample.",
    why: "each sample chip names its question and its short label",
  },
  {
    file: "components/talk/TalkFlow.tsx",
    prefix: "talk.stage.",
    why: "the interview's current stage",
  },
  {
    file: "components/import/ImportFlow.tsx",
    prefix: "import.consent.",
    why: "the consent line for the chosen recording mode",
  },
  {
    file: "components/import/ImportFlow.tsx",
    prefix: "import.form.show.",
    why: "one label per visibility choice",
  },
  {
    file: "components/import/ImportFlow.tsx",
    prefix: "import.files.order.",
    why: "how the voice notes came to be in this order (WhatsApp time, saved time or by hand)",
  },
  {
    file: "app/r/page.tsx",
    prefix: "rhub.care.",
    why: "the care state of each master's interview",
  },
  {
    file: "components/review/CardReview.tsx",
    prefix: "review.card.reject.",
    why: "one label per reason a card is sent back",
  },
  {
    file: "components/how/FieldTest.tsx",
    prefix: "field.who.",
    why: "each field change names who made it (master, teacher or reviewer)",
  },
  {
    file: "app/how/page.tsx",
    prefix: "howpage.",
    why: "an evaluation gate's target is either a howpage key or a literal number",
  },
];

export function inArea(key: string, areas: readonly Area[]): boolean {
  return ["core" as Area, ...areas].some((a) =>
    AREAS[a].some((p) => (p.endsWith(".") ? key.startsWith(p) : key === p)),
  );
}

const picked = new Map<string, Strings>();

/** The strings for these areas only (server side), in both languages. `core` is the root's. */
export function pickMessages(areas: readonly Area[]): Strings {
  const id = areas.join(",");
  const hit = picked.get(id);
  if (hit) return hit;
  const out = { kn: {}, en: {} } as Record<Lang, Partial<Record<MessageKey, string>>>;
  for (const key of Object.keys(messages.kn) as MessageKey[]) {
    const wanted = areas.some((a) =>
      AREAS[a].some((p) => (p.endsWith(".") ? key.startsWith(p) : key === p)),
    );
    if (!wanted) continue;
    out.kn[key] = messages.kn[key];
    out.en[key] = messages.en[key];
  }
  picked.set(id, out);
  return out;
}
