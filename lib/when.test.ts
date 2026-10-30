import { describe, expect, it } from "vitest";
import { formatWhen, kannadaDayPart } from "./when";

describe("dates as people in Karnataka say them (IST)", () => {
  it("names the part of the day in Kannada words, never AM or PM", () => {
    expect(kannadaDayPart(3)).toBe("ರಾತ್ರಿ");
    expect(kannadaDayPart(4)).toBe("ಬೆಳಿಗ್ಗೆ");
    expect(kannadaDayPart(11)).toBe("ಬೆಳಿಗ್ಗೆ");
    expect(kannadaDayPart(12)).toBe("ಮಧ್ಯಾಹ್ನ");
    expect(kannadaDayPart(15)).toBe("ಮಧ್ಯಾಹ್ನ");
    expect(kannadaDayPart(16)).toBe("ಸಂಜೆ");
    expect(kannadaDayPart(19)).toBe("ಸಂಜೆ");
    expect(kannadaDayPart(20)).toBe("ರಾತ್ರಿ");
    expect(kannadaDayPart(0)).toBe("ರಾತ್ರಿ");
  });

  it("formats in IST with the weekday, whatever the zone of the machine", () => {
    // 21:30 UTC on the 29th is 3:00 at night on Friday the 30th in India (the QR expiry case).
    const kn = formatWhen("2026-10-29T21:30:00.000Z", "kn");
    expect(kn).toBe("ಶುಕ್ರವಾರ, 30 ಅಕ್ಟೋಬರ್, ರಾತ್ರಿ 3:00");
    expect(kn).not.toMatch(/AM|PM/i);
    expect(formatWhen("2026-10-29T21:30:00.000Z", "en")).toBe("Fri, 30 Oct, 3:00 am");
    expect(formatWhen(new Date("2026-10-23T15:30:00.000Z"), "en")).toBe("Fri, 23 Oct, 9:00 pm");
    expect(formatWhen("2026-10-23T06:45:00.000Z", "kn")).toBe(
      "ಶುಕ್ರವಾರ, 23 ಅಕ್ಟೋಬರ್, ಮಧ್ಯಾಹ್ನ 12:15",
    );
  });

  it("gives null, never a raw string, for a missing or unreadable date", () => {
    expect(formatWhen(null, "kn")).toBeNull();
    expect(formatWhen(undefined, "en")).toBeNull();
    expect(formatWhen("not a date", "en")).toBeNull();
  });
});
