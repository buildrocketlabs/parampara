import { z } from "zod";
import raw from "@/docs/field/heard.json";

// "What we heard and what we changed" (README, docs/field/CHANGES.md and /how): a reviewed file,
// one entry per real, dated item with a source in the repo. `heard` quotes his own words; `saw` is
// what we saw and is never shown as a quote. A synthetic probe is marked sample (Law 7).

export const HEARD_WHO = ["master", "headmaster", "team", "probe"] as const;

const Words = z
  .object({ kn: z.string().trim().min(1).max(400), en: z.string().trim().min(1).max(400) })
  .strict();

export const HeardEntry = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    who: z.enum(HEARD_WHO),
    kind: z.enum(["heard", "saw"]),
    sample: z.boolean(),
    heard: Words,
    changed: Words,
    where: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .refine((e) => e.sample === (e.who === "probe"), "only the probe is Sample");
export type HeardEntry = z.infer<typeof HeardEntry>;

export const HeardFile = z
  .object({ version: z.literal(1), about: z.string(), entries: z.array(HeardEntry) })
  .strict();

/** The entries, oldest first (the order things happened). A malformed file shows none. */
export function heardEntries(file: unknown = raw): HeardEntry[] {
  const parsed = HeardFile.safeParse(file);
  if (!parsed.success) return [];
  return [...parsed.data.entries].sort((a, b) => a.date.localeCompare(b.date));
}
