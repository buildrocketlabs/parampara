// "Show me" photos on the server (docs/BUILD.md M5.3). The browser already re-encodes through a
// canvas, which drops EXIF; this is the second lock, for any caller that skips the browser. The
// JPEG is rebuilt from an allowlist of the segments a decoder needs (tables, one frame, scans) and
// cut at the end of image, so EXIF, XMP, ICC, comments, unknown segments and anything after the
// image are gone (safety audit M3). Odd or oversized files are refused. The photo is never stored.

export const PHOTO_MAX_BYTES = 1_500_000;
/** Far above the 1280 px the browser sends; refuses decompression bombs. */
export const PHOTO_MAX_SIDE = 4096;

const DQT = 0xdb;
const DHT = 0xc4;
const DRI = 0xdd;
const SOS = 0xda;
const EOI = 0xd9;
/** Baseline, extended and progressive Huffman frames: what phones and canvases write. */
const FRAMES = new Set([0xc0, 0xc1, 0xc2]);
const isFrameMarker = (m: number) =>
  m >= 0xc0 && m <= 0xcf && m !== DHT && m !== 0xc8 && m !== 0xcc;

/**
 * Exact lengths for the kept segments, so nothing rides along inside a table (audit F). `segment`
 * starts at the two length bytes.
 */
function soundSegment(marker: number, segment: Uint8Array): boolean {
  const body = segment.subarray(2);
  if (marker === DRI) return body.length === 2;
  if (marker === DQT) {
    let p = 0;
    while (p < body.length) {
      const pq = (body[p] ?? 0) >> 4;
      const tq = (body[p] ?? 0) & 0x0f;
      if (pq > 1 || tq > 3) return false;
      p += 1 + 64 * (pq + 1);
    }
    return body.length > 0 && p === body.length;
  }
  if (marker === DHT) {
    let p = 0;
    while (p < body.length) {
      const tc = (body[p] ?? 0) >> 4;
      const th = (body[p] ?? 0) & 0x0f;
      if (tc > 1 || th > 3 || p + 17 > body.length) return false;
      let codes = 0;
      for (let k = 1; k <= 16; k++) codes += body[p + k] ?? 0;
      if (codes > 256) return false;
      p += 17 + codes;
    }
    return body.length > 0 && p === body.length;
  }
  if (FRAMES.has(marker)) {
    const components = body[5] ?? 0;
    return components >= 1 && components <= 4 && body.length === 6 + 3 * components;
  }
  if (marker === SOS) {
    const components = body[0] ?? 0;
    return components >= 1 && components <= 4 && body.length === 4 + 2 * components;
  }
  return true;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The JPEG rebuilt from its image segments only; null when it is not a sound, sane JPEG. */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  if (!isJpeg(bytes)) return null;
  const out: Uint8Array[] = [Uint8Array.of(0xff, 0xd8)];
  let frame = false;
  let scan = false;
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    while (i < bytes.length && bytes[i] === 0xff) i++; // fill bytes before a marker
    const marker = bytes[i++];
    if (marker === undefined) return null;
    if (marker === EOI) {
      if (!frame || !scan) return null;
      out.push(Uint8Array.of(0xff, EOI));
      return concat(out); // anything after the image is dropped
    }
    // A second start of image, or a restart marker outside a scan: not a file we accept.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) return null;
    if (i + 1 >= bytes.length) return null;
    const len = ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0);
    if (len < 2 || i + len > bytes.length) return null;
    const segment = bytes.subarray(i, i + len);
    i += len;

    if (isFrameMarker(marker)) {
      if (!FRAMES.has(marker) || frame || len < 8) return null;
      const height = ((segment[3] ?? 0) << 8) | (segment[4] ?? 0);
      const width = ((segment[5] ?? 0) << 8) | (segment[6] ?? 0);
      if (!width || !height || width > PHOTO_MAX_SIDE || height > PHOTO_MAX_SIDE) return null;
      if (!soundSegment(marker, segment)) return null;
      frame = true;
      out.push(Uint8Array.of(0xff, marker), segment);
      continue;
    }
    if (marker === SOS) {
      if (!frame || !soundSegment(SOS, segment)) return null;
      scan = true;
      // Entropy coded data runs to the next marker that is not a stuffed zero or a restart.
      let j = i;
      while (j < bytes.length) {
        if (bytes[j] === 0xff) {
          const next = bytes[j + 1];
          if (next === 0x00 || (next !== undefined && next >= 0xd0 && next <= 0xd7)) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      out.push(Uint8Array.of(0xff, SOS), segment, bytes.subarray(i, j));
      i = j;
      continue;
    }
    if (marker === DQT || marker === DHT || marker === DRI) {
      if (!soundSegment(marker, segment)) return null;
      out.push(Uint8Array.of(0xff, marker), segment);
    }
    // Everything else (APP0 to APP15, COM, JPGn, DNL, DAC and the rest) is left out.
  }
  return null; // no end of image
}

/** True when a rebuild would remove anything: metadata, unknown segments or trailing bytes. */
export function hasJpegMetadata(bytes: Uint8Array): boolean {
  const clean = stripJpegMetadata(bytes);
  return clean === null || clean.length !== bytes.length;
}
