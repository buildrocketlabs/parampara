import { describe, expect, it } from "vitest";
import { numberUses, numbersIn, unsupportedNumbers } from "./grounding";

describe("number grounding", () => {
  it("reads digits in three scripts and English number words, not one", () => {
    expect([...numbersIn("10 minutes, ೧೫ days, १२ words, fourteen sticks, one box")].sort((a, b) => a - b)).toEqual([10, 12, 14, 15]);
  });

  it("keeps what each number counts", () => {
    expect(numberUses("for the first fifteen days, ten minutes")).toEqual([
      { n: 15, words: ["day", "minute"] },
      { n: 10, words: ["minute"] },
    ]);
  });

  it("refuses a number the source never says, or says about something else", () => {
    expect(unsupportedNumbers("Do this for twenty minutes", "For the first fifteen days, ten minutes")).toEqual(["20"]);
    expect(unsupportedNumbers("Practise for 10 minutes", "Take 10 sticks")).toEqual(["10 minute"]);
    expect(unsupportedNumbers("Show four sticks", "one bundle and four loose sticks")).toEqual([]);
    expect(unsupportedNumbers("Give the other two their work", "the other two already had their work")).toEqual([]);
    expect(unsupportedNumbers("Three groups", "Make three groups by reading level")).toEqual([]);
  });

  it("reads 'times' as what is counted, and a number in a sum or a range as counting nothing (extractor-08, -09)", () => {
    // Faithful paraphrases the extractor's validator refused before (24 Oct).
    expect(unsupportedNumbers("After three times, bring them inside.", "After walking it three times, they come inside.")).toEqual([]);
    expect(unsupportedNumbers("For three plus four, let the children put three seeds on the left.", "For three plus four, they put three seeds on the left and four seeds on the right.")).toEqual([]);
    expect(unsupportedNumbers("Sums within ten with seeds only, for one month.", "Sums within ten, for one month, only with seeds like this.")).toEqual([]);
    expect(unsupportedNumbers("Only up to five in the first week.", "Count up to five at first.")).toEqual([]);
    // Still refused: a number the source never says, or one that counts something else.
    expect(unsupportedNumbers("Walk it five times.", "After walking it three times, they come inside.")).toEqual(["5"]);
    expect(unsupportedNumbers("Walk it three days.", "After walking it three times, they come inside.")).toEqual(["3 day"]);
    expect(unsupportedNumbers("Sums within twenty.", "Sums within ten.")).toEqual(["20"]);
  });
});
