import type { Bilingual } from "@/lib/domain/fln";

import { fill } from "@/lib/i18n/fill";
import { messages } from "@/lib/i18n/messages";

// Dates for the officer's screens, in India time, in both languages.

const DAY: Record<"kn" | "en", Intl.DateTimeFormat> = {
  kn: new Intl.DateTimeFormat("kn-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }),
  en: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }),
};

export function dayOf(iso: string): Bilingual {
  const d = new Date(iso);
  return { kn: DAY.kn.format(d), en: DAY.en.format(d) };
}

export function weekRange(since: string, until: string): Bilingual {
  const from = dayOf(since);
  const to = dayOf(until);
  return {
    kn: fill(messages.kn["pulse.week"], { from: from.kn, to: to.kn }),
    en: fill(messages.en["pulse.week"], { from: from.en, to: to.en }),
  };
}

/** A share of a whole as a bar width, 4% at the least so a small shown bar is still visible. */
export function barWidth(n: number, max: number): string {
  if (max <= 0 || n <= 0) return "0%";
  return `${Math.max(4, Math.round((n / max) * 100))}%`;
}
