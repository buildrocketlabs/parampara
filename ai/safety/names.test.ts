import { describe, expect, it } from "vitest";
import { commonNamesIn, namesEchoed } from "./names";

// A name said bare (24 Oct): the answer check and the list of common first names, both directions.
describe("names said bare, and an answer that repeats one", () => {
  it.each([
    ["Ravi in my class does not speak at all. What should I do with Ravi?", "Greet Ravi at the door with a smile."],
    ["Ravi in my class does not speak at all.", "ಬೆಳಿಗ್ಗೆ ರವಿಯನ್ನು ಬಾಗಿಲಲ್ಲಿ ನಗುತ್ತಾ ಕರೆಯಿರಿ."],
    ["ನಮ್ಮ ಕ್ಲಾಸಿನಲ್ಲಿ ಲಕ್ಷ್ಮಿ ಮಾತಾಡಲ್ಲ.", "ಲಕ್ಷ್ಮಿಗೆ ಒಂದು ಸಣ್ಣ ಕೆಲಸ ಕೊಡಿ."],
    ["ನಮ್ಮ ಕ್ಲಾಸಿನಲ್ಲಿ ಲಕ್ಷ್ಮಿ ಮಾತಾಡಲ್ಲ.", "Give Lakshmi one small job."],
    ["Please teach Kavitha to read, she is in Class 2.", "Let Kavitha read two letter words."],
    // Audit, 25 Oct: the spelling speech to text gives, a listed name with a case ending, and an
    // unlisted name the cards only sound like (ಮನೆ is not Manu).
    ["ರಮೇಶ್ ಓದಲ್ಲ.", "ರಮೇಶ್‌ಗೆ ಒಂದು ಸಣ್ಣ ಕೆಲಸ ಕೊಡಿ."],
    ["ಮಂಜುನಾಥ್ ಓದಲ್ಲ.", "ಮಂಜುನಾಥನಿಗೆ ಒಂದು ಸಣ್ಣ ಕೆಲಸ ಕೊಡಿ."],
    ["My student Manu does not read.", "Give Manu a slate. ಮನೆಯಲ್ಲಿ ಓದಲಿ."],
    // Audit, 25 Oct: the usual spelling variants of a listed name.
    ["Ramesha does not read.", "Give Ramesha one small job."],
    ["Laxmee does not speak.", "Greet Laxmee at the door."],
    ["ನಾಗರಾಜ ಓದಲ್ಲ.", "Give Nagaraja one small job."],
    ["ರವಿ ಅಂತ ಒಬ್ಬ ಹುಡುಗ ಮಾತಾಡಲ್ಲ.", "Give Ravi one small job."],
  ])("holds an answer that repeats a name from %s", (question, answer) => {
    expect(namesEchoed(question, answer, "Greet the child at the door with a smile. Give the child one small job.")).toBeGreaterThan(0);
  });

  it.each([
    // Ordinary words, school words and the card's own words are not names.
    ["Children in my class do not speak. What should I do?", "Greet the child at the door with a smile."],
    ["Fourteen confuses them. How do I teach it?", "Fourteen is one bundle and four loose sticks."],
    ["My Lambani children speak no Kannada on Monday.", "Learn ten words of the Lambani language; say the Kannada word alongside."],
    ["ದೀಪಾವಳಿ ನಂತರ ಮಕ್ಕಳು ಅಕ್ಷರ ಮರೆತಿದ್ದಾರೆ.", "ದಿನಕ್ಕೆ ಒಂದೇ ಅಕ್ಷರ, ಮರಳಲ್ಲಿ."],
    ["Ravi in my class does not speak.", "Greet the child at the door with a smile."],
    ["Should I use Geeta's method?", "Geeta stands at the door and greets the child."],
    // Audit, 25 Oct: a listed name never matches an English word by sound, and a word that only
    // starts her sentence is not a name.
    ["Suma cannot read the same letter.", "Show the same letter again the next day."],
    ["Deepa sits at the back. How deep should the sand be?", "Spread sand in a plate, not too deep."],
    ["Always the children forget. Sometimes they cry.", "Always the same letter. Sometimes a song."],
    ["Subtraction is hard for them.", "Subtraction with sticks: take away one bundle."],
    ["Deepa cannot read. How deep is the problem?", "Not too deep: one letter a day."],
    ["Should I teach Phonics first?", "Phonics can wait: one letter a day in sand."],
  ])("lets an answer through for %s", (question, answer) => {
    expect(namesEchoed(question, answer, "Greet the child at the door with a smile. Fourteen is one bundle and four loose sticks. ಗೀತಾ Geeta")).toBe(0);
  });

  it("finds common first names in either script, never everyday words that share their sounds", () => {
    expect(commonNamesIn("Ravi in my class")).toEqual(["ರವಿ"]);
    expect(commonNamesIn("ರಮೇಶನಿಗೆ ಓದೋಕೆ ಬರಲ್ಲ")).toEqual(["ರಮೇಶ"]);
    expect(commonNamesIn("ಮಂಜುನಾಥ್ ಓದಲ್ಲ")).toEqual(["ಮಂಜುನಾಥ್"]);
    for (const text of ["ದೀಪಾವಳಿ ರಜೆ", "ರವಿವಾರ", "ರಾಜ ರಾಣಿ ಕಥೆ", "ಮಂಜು ಮುಸುಕಿದ ಬೆಳಿಗ್ಗೆ", "Dasara puja holidays", "a ray of sun", "ಕಾವ್ಯ ಓದಿಸಿ"]) {
      expect(commonNamesIn(text)).toEqual([]);
    }
  });
});
