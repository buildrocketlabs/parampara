import { describe, expect, it } from "vitest";
import { fitWithin, photoBase64, PHOTO_MAX_SIDE } from "./prepare";

describe("show me photo in the browser", () => {
  it("scales the long side down to 1280 px and keeps the shape", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: PHOTO_MAX_SIDE, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: PHOTO_MAX_SIDE });
  });

  it("never scales a small photo up", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1, 50_000)).toEqual({ width: 1, height: PHOTO_MAX_SIDE });
  });

  it("encodes bytes as base64 the server can read back", async () => {
    const bytes = Uint8Array.from({ length: 70_000 }, (_, i) => i % 256);
    const b64 = await photoBase64(new Blob([bytes]));
    expect(Buffer.from(b64, "base64").equals(Buffer.from(bytes))).toBe(true);
  });
});
