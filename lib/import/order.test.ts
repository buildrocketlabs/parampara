import { describe, expect, it } from "vitest";
import { orderVoiceNotes, parseNoteStamp, sameFile, stampLabel } from "./order";

const f = (name: string, lastModified = 0) => ({ name, lastModified, size: 1 });

describe("parseNoteStamp", () => {
  it("reads Android voice notes and audio files", () => {
    expect(parseNoteStamp("PTT-20261028-WA0003.opus")).toEqual({
      day: 20261028,
      secs: null,
      seq: 3,
    });
    expect(parseNoteStamp("AUD-20261028-WA0012.opus")).toEqual({
      day: 20261028,
      secs: null,
      seq: 12,
    });
    expect(parseNoteStamp("ptt-20261028-wa0007.ogg")?.seq).toBe(7);
  });

  it("reads desktop and web names, 24 hour and AM PM, with copies", () => {
    expect(parseNoteStamp("WhatsApp Audio 2026-10-28 at 10.41.22.ogg")).toEqual({
      day: 20261028,
      secs: 10 * 3600 + 41 * 60 + 22,
      seq: 0,
    });
    expect(parseNoteStamp("WhatsApp Ptt 2026-10-28 at 2.05.11 PM.ogg")?.secs).toBe(
      14 * 3600 + 5 * 60 + 11,
    );
    expect(parseNoteStamp("WhatsApp Ptt 2026-10-28 at 12.05.11 AM.ogg")?.secs).toBe(5 * 60 + 11);
    expect(parseNoteStamp("WhatsApp Audio 2026-10-28 at 10.41.22 (1).ogg")?.seq).toBe(1);
    expect(parseNoteStamp("WhatsApp Audio 2026-10-28 at 10_41_22.opus")?.secs).toBe(38482);
  });

  it("reads an iPhone chat export", () => {
    expect(parseNoteStamp("00000012-AUDIO-2026-10-28-10-41-22.opus")).toEqual({
      day: 20261028,
      secs: 38482,
      seq: 12,
    });
  });

  it("ignores other names and impossible dates", () => {
    expect(parseNoteStamp("mahesh part 1.m4a")).toBeNull();
    expect(parseNoteStamp("PTT-20261328-WA0003.opus")).toBeNull();
    expect(parseNoteStamp("WhatsApp Audio 2026-10-28 at 25.41.22.ogg")).toBeNull();
    expect(parseNoteStamp("recording.opus")).toBeNull();
  });
});

describe("orderVoiceNotes", () => {
  it("orders Android notes by day, then WhatsApp's counter (not by text)", () => {
    const picked = [
      f("PTT-20261028-WA0012.opus"),
      f("PTT-20261028-WA0003.opus"),
      f("PTT-20261027-WA0040.opus"),
      f("PTT-20261028-WA0100.opus"),
    ];
    const { files, basis } = orderVoiceNotes(picked);
    expect(files.map((x) => x.name)).toEqual([
      "PTT-20261027-WA0040.opus",
      "PTT-20261028-WA0003.opus",
      "PTT-20261028-WA0012.opus",
      "PTT-20261028-WA0100.opus",
    ]);
    expect(basis).toBe("whatsapp");
  });

  it("orders desktop names by clock time across AM and PM", () => {
    const { files } = orderVoiceNotes([
      f("WhatsApp Ptt 2026-10-28 at 1.02.00 PM.ogg"),
      f("WhatsApp Ptt 2026-10-28 at 11.59.59 AM (1).ogg"),
      f("WhatsApp Ptt 2026-10-28 at 11.59.59 AM.ogg"),
    ]);
    expect(files.map((x) => x.name)).toEqual([
      "WhatsApp Ptt 2026-10-28 at 11.59.59 AM.ogg",
      "WhatsApp Ptt 2026-10-28 at 11.59.59 AM (1).ogg",
      "WhatsApp Ptt 2026-10-28 at 1.02.00 PM.ogg",
    ]);
  });

  it("puts plain names after, by saved time and then natural name order", () => {
    const { files, basis } = orderVoiceNotes([
      f("note 10.m4a", 5),
      f("note 2.m4a", 5),
      f("first.m4a", 1),
      f("AUD-20261028-WA0001.opus", 99),
    ]);
    expect(files.map((x) => x.name)).toEqual([
      "AUD-20261028-WA0001.opus",
      "first.m4a",
      "note 2.m4a",
      "note 10.m4a",
    ]);
    expect(basis).toBe("partly");
  });

  it("is stable for identical keys and says when nothing had a time", () => {
    const a = f("same.ogg", 1);
    const b = f("same.ogg", 1);
    const { files, basis } = orderVoiceNotes([a, b]);
    expect(files[0]).toBe(a);
    expect(files[1]).toBe(b);
    expect(basis).toBe("saved");
  });

  it("returns a new array and leaves the input alone", () => {
    const input = [f("PTT-20261028-WA0002.opus"), f("PTT-20261028-WA0001.opus")];
    const copy = [...input];
    orderVoiceNotes(input);
    expect(input).toEqual(copy);
  });

  it("handles none", () => {
    expect(orderVoiceNotes([])).toEqual({ files: [], basis: "saved" });
  });
});

describe("stampLabel", () => {
  it("shows the date with WhatsApp's counter or the clock time", () => {
    expect(stampLabel(parseNoteStamp("PTT-20261028-WA0003.opus")!)).toBe(
      "28.10.2026 · WhatsApp #3",
    );
    expect(stampLabel(parseNoteStamp("WhatsApp Ptt 2026-10-28 at 2.05.11 PM.ogg")!)).toBe(
      "28.10.2026 · 14:05:11",
    );
  });
});

describe("sameFile", () => {
  it("matches name, size and time", () => {
    expect(sameFile(f("a", 1), f("a", 1))).toBe(true);
    expect(sameFile(f("a", 1), f("a", 2))).toBe(false);
  });
});
