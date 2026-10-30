import raw from "@/docs/field/changes.json";
import { FieldChanges, type FieldChange } from "./change-schema";

// "You said, we changed" on /how: a versioned, reviewed file (docs/field/changes.json), never a
// form anyone can post to. The speaker is a role word, so a person can never be named (Law 6), and
// every entry is something really said in the field (Law 7). The schema lives in change-schema.ts
// so scripts/add-change.mjs can use the very same one.

export { CHANGE_WHO, FieldChange, FieldChanges, type ChangeWho } from "./change-schema";

/** The entries, newest first. A malformed file shows none (and fails lib/field/changes.test.ts). */
export function fieldChanges(file: unknown = raw): FieldChange[] {
  const parsed = FieldChanges.safeParse(file);
  if (!parsed.success) return [];
  return [...parsed.data.entries].sort((a, b) => b.date.localeCompare(a.date));
}
