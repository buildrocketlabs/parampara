import { describe, expect, it } from "vitest";
import { hasJpegMetadata, isJpeg, PHOTO_MAX_SIDE, stripJpegMetadata } from "./jpeg";

// Tiny, structurally valid JPEG skeletons: enough to test segment surgery, not to decode.
function seg(marker: number, payload: number[]): number[] {
  const len = payload.length + 2;
  return [0xff, marker, len >> 8, len & 0xff, ...payload];
}
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const sof = (w: number, h: number, marker = 0xc0) =>
  seg(marker, [8, h >> 8, h & 0xff, w >> 8, w & 0xff, 1, 1, 0x11, 0]);
const SCAN = [...seg(0xda, [1, 1, 0, 0, 63, 0]), 0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56];
const text = (b: Uint8Array) => String.fromCharCode(...b);
/** One 8 bit quantisation table, and one Huffman table with a single code. */
const DQT = seg(0xdb, [0, ...Array.from({ length: 64 }, (_, i) => i + 1)]);
const DHT = seg(0xc4, [0, 1, ...Array(15).fill(0), 0]);

const JPEG = Uint8Array.from([
  0xff,
  0xd8,
  ...seg(0xe0, ascii("JFIF\0")),
  ...seg(0xe1, ascii("Exif\0\0GPS 15.35N 76.15E")),
  ...seg(0xfe, ascii("taken at a school")),
  ...DQT,
  ...sof(640, 480),
  ...DHT,
  ...SCAN,
  0xff,
  0xd9,
]);

describe("show me photo on the server", () => {
  it("knows a JPEG from anything else", () => {
    expect(isJpeg(JPEG)).toBe(true);
    expect(isJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe(false);
  });

  it("rebuilds from image segments only: EXIF, JFIF and comments are gone, the scan is intact", () => {
    expect(hasJpegMetadata(JPEG)).toBe(true);
    const clean = stripJpegMetadata(JPEG)!;
    expect(clean).not.toBeNull();
    expect(hasJpegMetadata(clean)).toBe(false);
    for (const gone of ["GPS", "school", "JFIF", "Exif"]) expect(text(clean)).not.toContain(gone);
    // The entropy data keeps its stuffed zero and restart marker.
    expect(text(clean)).toContain(String.fromCharCode(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56));
    expect([...clean.slice(-2)]).toEqual([0xff, 0xd9]);
  });

  it("drops what hides between scans, after the image, or in JPGn segments (audit M3)", () => {
    const sneaky = Uint8Array.from([
      0xff,
      0xd8,
      ...DQT,
      ...sof(64, 64, 0xc2),
      ...SCAN,
      ...seg(0xe1, ascii("Exif GPS between scans")),
      ...seg(0xf5, ascii("JPGn GPS")),
      ...SCAN,
      0xff,
      0xd9,
      ...ascii("GPS after the end"),
    ]);
    const clean = stripJpegMetadata(sneaky)!;
    expect(clean).not.toBeNull();
    expect(text(clean)).not.toContain("GPS");
    expect(hasJpegMetadata(sneaky)).toBe(true);
  });

  it("refuses broken, oversized and unusual files instead of passing them on", () => {
    expect(stripJpegMetadata(JPEG.subarray(0, 12))).toBeNull();
    expect(stripJpegMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]))).toBeNull();
    const huge = Uint8Array.from([
      0xff,
      0xd8,
      ...sof(PHOTO_MAX_SIDE + 1, 100),
      ...SCAN,
      0xff,
      0xd9,
    ]);
    expect(stripJpegMetadata(huge)).toBeNull();
    const zero = Uint8Array.from([0xff, 0xd8, ...sof(0, 0), ...SCAN, 0xff, 0xd9]);
    expect(stripJpegMetadata(zero)).toBeNull();
    const lossless = Uint8Array.from([0xff, 0xd8, ...sof(64, 64, 0xc3), ...SCAN, 0xff, 0xd9]);
    expect(stripJpegMetadata(lossless)).toBeNull();
    const noFrame = Uint8Array.from([0xff, 0xd8, ...SCAN, 0xff, 0xd9]);
    expect(stripJpegMetadata(noFrame)).toBeNull();
  });
});

describe("show me photo tables", () => {
  it("refuses a table segment that carries extra bytes (audit F)", () => {
    const fatDqt = seg(0xdb, [0, ...Array(64).fill(1), ...ascii("GPS hidden")]);
    const fatDri = seg(0xdd, [0, 4, ...ascii("GPS")]);
    for (const bad of [fatDqt, fatDri]) {
      const file = Uint8Array.from([0xff, 0xd8, ...bad, ...sof(16, 16), ...SCAN, 0xff, 0xd9]);
      expect(stripJpegMetadata(file)).toBeNull();
    }
  });
});
