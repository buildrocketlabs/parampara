import { describe, expect, it } from "vitest";
import {
  cardImageFileName,
  cardImagePath,
  SAMPLE_LINE,
  SHARE_LINE,
  shareText,
  whatsappUrl,
} from "./card";

const title = { kn: "ಮರಳಲ್ಲಿ ದಿನಕ್ಕೊಂದು ಅಕ್ಷರ", en: "One letter a day, written in sand" };

describe("the words that travel with a Tomorrow card", () => {
  it("leads with the Kannada title, then Parampara, then the master as they chose", () => {
    expect(shareText({ title, credit: "Sharanappa", isSample: false }).split("\n")).toEqual([
      title.kn,
      SHARE_LINE,
      "Sharanappa ಅವರ ಅನುಭವ",
    ]);
  });

  it("never names a master who chose to stay anonymous", () => {
    expect(shareText({ title, credit: null, isSample: false })).toContain(
      "ಒಬ್ಬ ಹಿರಿಯ ಶಿಕ್ಷಕರ ಅನುಭವ",
    );
  });

  it("keeps the Sample label on Sample cards (Law 7)", () => {
    expect(shareText({ title, credit: "Geetha", isSample: true })).toContain(SAMPLE_LINE);
    expect(shareText({ title, credit: "Geetha", isSample: false })).not.toContain("Sample");
  });

  it("builds the image path, a safe file name and a WhatsApp link with the image on its own line", () => {
    expect(cardImagePath("sample-card-01")).toBe("/api/cards/sample-card-01/image");
    expect(cardImageFileName({ id: "../x y", isSample: true })).toBe("parampara-sample-xy.png");
    const url = whatsappUrl("ಪರಂಪರೆ", "https://parampara-eta.vercel.app/api/cards/a/image");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1]!)).toBe(
      "ಪರಂಪರೆ\nhttps://parampara-eta.vercel.app/api/cards/a/image",
    );
  });
});
