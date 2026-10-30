import { describe, expect, it } from "vitest";
import { pickFieldChips, type ChipCard } from "./field-chips";

const card = (id: string, extra: Partial<ChipCard> = {}): ChipCard => ({
  id,
  masterId: "m1",
  status: "approved",
  isSample: false,
  topic: "letters",
  titleKn: "ಕಾರ್ಡ್",
  titleEn: "Card",
  problemKn: "ಸಮಸ್ಯೆ",
  problemEn: "Problem",
  updatedAt: "2026-10-28T10:00:00Z",
  ...extra,
});
const consented = new Set(["m1", "m2"]);

describe("field chips (D64, D83)", () => {
  it("never shows a Sample card, a draft or a master without consent", () => {
    const chips = pickFieldChips(
      [
        card("sample", { isSample: true }),
        card("draft", { status: "draft" }),
        card("noconsent", { masterId: "m9" }),
        card("real"),
      ],
      consented,
    );
    expect(chips.map((c) => c.cardId)).toEqual(["real"]);
  });

  it("never pads: no field card means no chip", () => {
    expect(
      pickFieldChips([card("s1", { isSample: true }), card("s2", { isSample: true })], consented),
    ).toEqual([]);
    expect(pickFieldChips([], consented)).toEqual([]);
  });

  it("shows at most three, newest first, one per topic before repeating a topic", () => {
    const chips = pickFieldChips(
      [
        card("a", { topic: "letters", updatedAt: "2026-10-28T12:00:00Z" }),
        card("b", { topic: "letters", updatedAt: "2026-10-28T11:00:00Z" }),
        card("c", { topic: "numbers", updatedAt: "2026-10-28T10:00:00Z", masterId: "m2" }),
        card("d", { topic: "multilevel", updatedAt: "2026-10-28T09:00:00Z" }),
      ],
      consented,
    );
    expect(chips.map((c) => c.cardId)).toEqual(["a", "c", "d"]);
  });

  it("asks the card's own problem, in both languages", () => {
    const [chip] = pickFieldChips(
      [card("a", { problemKn: "ಮಕ್ಕಳು ಬ ದ ಗೊಂದಲ", problemEn: "Children mix up ಬ and ದ" })],
      consented,
    );
    expect(chip?.ask).toEqual({ kn: "ಮಕ್ಕಳು ಬ ದ ಗೊಂದಲ", en: "Children mix up ಬ and ದ" });
    expect(chip?.title).toEqual({ kn: "ಕಾರ್ಡ್", en: "Card" });
  });

  it("skips a card with an empty title or problem in either language", () => {
    expect(
      pickFieldChips([card("a", { problemEn: " " }), card("b", { titleKn: "" })], consented),
    ).toEqual([]);
  });
});
