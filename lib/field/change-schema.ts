import { z } from "zod";

// "You said, we changed" (docs/field/changes.json, D67): the schema, and the pure step of turning
// one quotable feedback row into an entry (scripts/add-change.mjs, D82). Self contained (zod only,
// no "@/" imports), so the founder's script can import this very file with Node's type stripping.

export const CHANGE_WHO = [
  "teacher",
  "master",
  "headmaster",
  "reviewer",
  "officer",
  "mentor",
] as const;
export type ChangeWho = (typeof CHANGE_WHO)[number];

const Words = z
  .object({ kn: z.string().trim().min(1).max(400), en: z.string().trim().min(1).max(400) })
  .strict();
/** A screenshot served from public/field/changes/. */
const Shot = z
  .string()
  .regex(/^\/field\/changes\/[a-z0-9][a-z0-9-]*\.(png|jpg|webp)$/)
  .nullable();

export const FieldChange = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    who: z.enum(CHANGE_WHO),
    said: Words,
    changed: Words,
    before: Shot,
    after: Shot,
  })
  .strict();
export type FieldChange = z.infer<typeof FieldChange>;

export const FieldChanges = z
  .object({ version: z.literal(1), about: z.string(), entries: z.array(FieldChange) })
  .strict();
export type FieldChangesFile = z.infer<typeof FieldChanges>;

// ── From a feedback row to an entry (founder only) ─────────────────────────

/** The feedback columns the script reads (0005 and 0007). */
export type QuotableFeedback = {
  id: string;
  text: string | null;
  quoteOk: boolean;
  roleWord: string | null;
  isSample: boolean;
  createdAt: string;
};

export type ChangeInput = {
  feedback: QuotableFeedback;
  /** Her words in the other language, when she spoke Kannada (or English). */
  saidOther?: string;
  changedKn: string;
  changedEn: string;
  /** Screenshot file extensions, when given: the entry points at the copies in public/. */
  beforeExt?: string | null;
  afterExt?: string | null;
  /** The day the change shipped; defaults to the day she said it (IST). */
  date?: string;
};

export type ChangeRefusal =
  | "not_quotable"
  | "sample"
  | "no_words"
  | "no_role"
  | "needs_other_language"
  | "bad_shot"
  | "invalid";

const KANNADA = /[ಀ-೿]/;

/** Which language her words are in: any Kannada letter makes it Kannada. */
export function wordsLang(text: string): "kn" | "en" {
  return KANNADA.test(text) ? "kn" : "en";
}

/** The screenshot's served path: public/field/changes/fb-<first 8 of the row id>-<which>.<ext>. */
export function shotPath(feedbackId: string, which: "before" | "after", ext: string): string {
  const id = feedbackId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  return `/field/changes/fb-${id}-${which}.${ext.toLowerCase().replace(/^\./, "")}`;
}

export function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * One entry from one feedback row, only with her yes to being quoted, only from the field (never
 * Sample), and only under a role word (Law 6, Law 7). Nothing here invents or edits her words:
 * the other language is the founder's rendering of them, given on the command line.
 */
export function buildChange(
  input: ChangeInput,
): { ok: true; entry: FieldChange } | { ok: false; error: ChangeRefusal } {
  const f = input.feedback;
  if (!f.quoteOk) return { ok: false, error: "not_quotable" };
  if (f.isSample) return { ok: false, error: "sample" };
  const words = f.text?.trim();
  if (!words) return { ok: false, error: "no_words" };
  const who = z.enum(CHANGE_WHO).safeParse(f.roleWord);
  if (!who.success) return { ok: false, error: "no_role" };
  const other = input.saidOther?.trim();
  if (!other) return { ok: false, error: "needs_other_language" };
  const said = wordsLang(words) === "kn" ? { kn: words, en: other } : { kn: other, en: words };

  const ext = /^(png|jpg|webp)$/;
  for (const e of [input.beforeExt, input.afterExt]) {
    if (e && !ext.test(e.toLowerCase())) return { ok: false, error: "bad_shot" };
  }
  const entry = FieldChange.safeParse({
    date: input.date ?? istDate(f.createdAt),
    who: who.data,
    said,
    changed: { kn: input.changedKn, en: input.changedEn },
    before: input.beforeExt ? shotPath(f.id, "before", input.beforeExt) : null,
    after: input.afterExt ? shotPath(f.id, "after", input.afterExt) : null,
  });
  return entry.success ? { ok: true, entry: entry.data } : { ok: false, error: "invalid" };
}

/** The file with one more entry, still valid; the same words twice are refused. */
export function appendChange(
  file: unknown,
  entry: FieldChange,
): { ok: true; file: FieldChangesFile } | { ok: false; error: "invalid_file" | "duplicate" } {
  const parsed = FieldChanges.safeParse(file);
  if (!parsed.success) return { ok: false, error: "invalid_file" };
  if (parsed.data.entries.some((e) => e.said.kn === entry.said.kn && e.said.en === entry.said.en)) {
    return { ok: false, error: "duplicate" };
  }
  return { ok: true, file: { ...parsed.data, entries: [...parsed.data.entries, entry] } };
}
