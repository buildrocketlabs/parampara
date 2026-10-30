import type { Lang } from "@/lib/i18n";

// A date and time as people in Karnataka say it, always in IST whatever the server's or phone's
// own zone (F-P1). Kannada names the part of the day in words (ರಾತ್ರಿ 9:10), never a Latin AM or
// PM, which is what the browser's kn-IN format gives; the weekday and month come from Intl.
const TZ = "Asia/Kolkata";

/** ಬೆಳಿಗ್ಗೆ 4 to 12, ಮಧ್ಯಾಹ್ನ 12 to 4, ಸಂಜೆ 4 to 8, ರಾತ್ರಿ 8 to 4 (hours in IST, 0 to 23). */
export function kannadaDayPart(hour: number): string {
  if (hour >= 4 && hour < 12) return "ಬೆಳಿಗ್ಗೆ";
  if (hour >= 12 && hour < 16) return "ಮಧ್ಯಾಹ್ನ";
  if (hour >= 16 && hour < 20) return "ಸಂಜೆ";
  return "ರಾತ್ರಿ";
}

function clock(date: Date): { hour: number; minute: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { hour, minute };
}

/**
 * "ಗುರುವಾರ, 29 ಅಕ್ಟೋಬರ್, ರಾತ್ರಿ 9:10" or "Thu, 29 Oct, 9:10 pm", in IST. Null for a missing or
 * unreadable date, so a caller never shows "Invalid Date" or a raw ISO string.
 */
export function formatWhen(value: string | Date | null | undefined, lang: Lang): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const { hour, minute } = clock(date);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  if (lang === "kn") {
    const day = new Intl.DateTimeFormat("kn-IN", {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date);
    return `${day}, ${kannadaDayPart(hour)} ${h12}:${minute}`;
  }
  const day = new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  return `${day}, ${h12}:${minute} ${hour < 12 ? "am" : "pm"}`;
}
