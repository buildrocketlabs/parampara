import { describe, expect, it } from "vitest";
import { MAX_WAV_BYTES, parseAskRequest } from "./parse-request";

// A small JPEG skeleton with EXIF: SOI, APP1, DQT, SOF0 16x16, SOS with data, EOI.
function seg(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
}
const JPEG = Uint8Array.from([
  0xff,
  0xd8,
  ...seg(
    0xe1,
    [..."Exif GPS 15.35N"].map((c) => c.charCodeAt(0)),
  ),
  ...seg(0xdb, [0, ...Array(64).fill(1)]),
  ...seg(0xc0, [8, 0, 16, 0, 16, 1, 1, 0x11, 0]),
  ...seg(0xda, [1, 1, 0, 0, 63, 0]),
  0x12,
  0x34,
  0xff,
  0xd9,
]);
const post = (body: BodyInit, type: string, url = "http://x/api/ask") =>
  new Request(url, { method: "POST", body, headers: type ? { "content-type": type } : {} });
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

describe("POST /api/ask body", () => {
  it("takes a typed question, with an optional photo as base64, and strips the photo's metadata", async () => {
    const plain = await parseAskRequest(
      post(JSON.stringify({ text: " hi ", lang: "en" }), "application/json"),
      "kn",
    );
    expect(plain).toEqual({ ok: true, text: "hi", lang: "en", wav: undefined, photo: undefined });
    const withPhoto = await parseAskRequest(
      post(JSON.stringify({ text: "q", lang: "kn", photo: b64(JPEG) }), "application/json"),
      "kn",
    );
    expect(withPhoto.ok).toBe(true);
    if (withPhoto.ok)
      expect(Buffer.from(withPhoto.photo!).includes(Buffer.from("GPS"))).toBe(false);
  });

  it("takes multipart text, audio and photo", async () => {
    const form = new FormData();
    form.set("text", "q");
    form.set("lang", "hi");
    form.set("photo", new Blob([JPEG], { type: "image/jpeg" }));
    const res = await parseAskRequest(
      new Request("http://x/api/ask", { method: "POST", body: form }),
      "kn",
    );
    expect(res).toMatchObject({ ok: true, text: "q", lang: "hi" });
  });

  it("refuses a photo that is not a JPEG (415), and anything too large (413)", async () => {
    const png = await parseAskRequest(
      post(
        JSON.stringify({
          text: "q",
          lang: "en",
          photo: b64(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2])),
        }),
        "application/json",
      ),
      "kn",
    );
    expect(png).toEqual({ ok: false, status: 415, error: "photo_invalid" });
    const huge = await parseAskRequest(
      post(
        JSON.stringify({ text: "q", lang: "en", photo: "A".repeat(2_100_000) }),
        "application/json",
      ),
      "kn",
    );
    expect(huge).toMatchObject({ ok: false, status: 413 });
    const bigWav = await parseAskRequest(
      post(new Uint8Array(MAX_WAV_BYTES + 1), "audio/wav"),
      "kn",
    );
    expect(bigWav).toMatchObject({ ok: false, status: 413 });
  });

  it("refuses an empty or malformed body", async () => {
    expect(await parseAskRequest(post("{", "application/json"), "kn")).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(await parseAskRequest(post(new FormData(), ""), "kn")).toMatchObject({ ok: false });
  });
});
