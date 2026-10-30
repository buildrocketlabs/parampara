// "Show me" photos in the browser (docs/BUILD.md M5.3). A phone photo is often 4 to 12 MB and
// carries EXIF (GPS, time, device). Drawing it on a canvas and encoding a fresh JPEG keeps only the
// pixels: no metadata survives a canvas. The long side is at most 1280 px, which is enough to read
// a slate and small enough for a bad network. The photo lives in memory only, never in storage.

export const PHOTO_MAX_SIDE = 1280;
export const PHOTO_QUALITY = 0.8;
/** The server takes at most 1.5 MB; stay under it with room to spare. */
export const PHOTO_TARGET_BYTES = 1_400_000;
/** Anything larger is not a phone photo of a slate. */
const SOURCE_MAX_BYTES = 30_000_000;

export class PhotoError extends Error {
  constructor(readonly code: "not_image" | "too_large" | "cannot_open") {
    super(code);
    this.name = "PhotoError";
  }
}

export type PreparedPhoto = {
  blob: Blob;
  width: number;
  height: number;
  /** true: the browser's own face detector found a face. null: no detector here (most browsers). */
  faceSeen: boolean | null;
};

/** Scale (w, h) down so the long side is at most `max`; never up. Whole pixels, at least 1. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_SIDE) {
  const long = Math.max(width, height);
  const scale = long > max ? max / long : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" turns the photo upright from its EXIF orientation before the EXIF is dropped.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to an <img>, which some browsers decode when createImageBitmap cannot.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new PhotoError("cannot_open");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new PhotoError("cannot_open"))),
      "image/jpeg",
      quality,
    ),
  );
}

type FaceDetectorLike = { detect(source: CanvasImageSource): Promise<unknown[]> };
type FaceDetectorCtor = new (opts?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => FaceDetectorLike;

/** A warning only, never relied on: most browsers have no FaceDetector, and it can miss faces. */
async function detectFace(canvas: HTMLCanvasElement): Promise<boolean | null> {
  const Ctor = (globalThis as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
  if (!Ctor) return null;
  try {
    const faces = await new Ctor({ fastMode: true, maxDetectedFaces: 1 }).detect(canvas);
    return faces.length > 0;
  } catch {
    return null;
  }
}

export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  if (!file.type.startsWith("image/")) throw new PhotoError("not_image");
  if (file.size > SOURCE_MAX_BYTES) throw new PhotoError("too_large");
  const source = await decode(file);
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!w || !h) throw new PhotoError("cannot_open");
  const size = fitWithin(w, h);

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("cannot_open");
  // A white ground, so a transparent PNG does not turn black as a JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(source, 0, 0, size.width, size.height);
  if ("close" in source) source.close();

  let blob = await toJpeg(canvas, PHOTO_QUALITY);
  if (blob.size > PHOTO_TARGET_BYTES) blob = await toJpeg(canvas, 0.6);
  if (blob.size > PHOTO_TARGET_BYTES) throw new PhotoError("too_large");
  const faceSeen = await detectFace(canvas);
  canvas.width = canvas.height = 0; // let the pixels go now
  return { blob, width: size.width, height: size.height, faceSeen };
}

/** Base64 for the JSON body, in chunks so a large photo does not overflow the call stack. */
export async function photoBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
