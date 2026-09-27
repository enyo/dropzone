// Carrying a JPEG's EXIF over to a resized copy of it.
//
// A canvas cannot write metadata, so when `resizeImage` re-encodes a photo,
// the camera's EXIF -- date taken, make and model, location -- would be lost.
// This copies the block across from the original. Both images are data URLs
// at that point, so it works on their base64 directly.

const SOI = 0xd8;
const SOS = 0xda;
const APP0 = 0xe0;
const APP1 = 0xe1;

// How much of a JPEG is decoded to look at its segments, in bytes. EXIF sits
// at the front and is at most 64 KiB, so this reaches past it in all but
// unusual files; anything else falls back to decoding the whole thing. A
// multiple of three, so the base64 it came from ends on a whole group.
const HEAD_BYTES = 3 * 65536;

type Segment = { marker: number; start: number; end: number };

function decode(base64: string): Uint8Array {
  let binary = atob(base64);
  let bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array): string {
  // In slices, because `fromCharCode` takes the bytes as arguments, and an
  // image has more of those than an engine will pass in one call.
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// The base64 of a data URL of the given type, or null for anything else.
function base64Of(dataURL: string, type: string): string | null {
  let prefix = `data:${type};base64,`;
  return dataURL.startsWith(prefix) ? dataURL.slice(prefix.length) : null;
}

// The segments ahead of the image data, or null if the bytes run out before
// it starts -- which for a header decoded on its own means it was cut too
// short. Anything that is not a marker where one should be ends the search.
function segmentsOf(bytes: Uint8Array): Segment[] | null {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) {
    return [];
  }
  let segments: Segment[] = [];
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff || bytes[p + 1] === SOS) {
      return segments;
    }
    let end = p + 2 + ((bytes[p + 2] << 8) | bytes[p + 3]);
    if (end > bytes.length) {
      return null;
    }
    segments.push({ marker: bytes[p + 1], start: p, end });
    p = end;
  }
  return null;
}

// A JPEG's segments, decoding no more of its base64 than it takes to reach
// them. `chars` is how much of the base64 that was.
function readHead(base64: string) {
  let chars = Math.min(base64.length, (HEAD_BYTES / 3) * 4);
  let bytes = decode(base64.slice(0, chars));
  let segments = segmentsOf(bytes);
  if (segments == null && chars < base64.length) {
    chars = base64.length;
    bytes = decode(base64);
    segments = segmentsOf(bytes);
  }
  return { bytes, segments: segments ?? [], chars };
}

// `resized` with the first APP1 segment of `original` added, which is where a
// JPEG keeps its EXIF. Returned unchanged if there is none, or if either one
// is not a JPEG.
//
// It never throws. This runs inside `transformFile`, and an exception there
// would leave the upload waiting for a `done` that never comes; losing the
// metadata is the better outcome.
export function restoreExif(original: string, resized: string): string {
  try {
    return insertExif(original, resized);
  } catch {
    return resized;
  }
}

function insertExif(original: string, resized: string): string {
  let originalBase64 = base64Of(original, "image/jpeg");
  let resizedBase64 = base64Of(resized, "image/jpeg");
  if (originalBase64 == null || resizedBase64 == null) {
    return resized;
  }

  let source = readHead(originalBase64);
  let exif = source.segments.find((segment) => segment.marker === APP1);
  if (exif == null) {
    return resized;
  }
  let block = source.bytes.subarray(exif.start, exif.end);

  let target = decode(resizedBase64);
  let first = segmentsOf(target)?.[0];
  if (target[0] !== 0xff || target[1] !== SOI) {
    return resized;
  }
  // After the JFIF header when there is one, since that has to come first,
  // and straight after the start-of-image marker otherwise.
  let at = first?.marker === APP0 ? first.end : 2;

  let joined = new Uint8Array(target.length + block.length);
  joined.set(target.subarray(0, at));
  joined.set(block, at);
  joined.set(target.subarray(at), at + block.length);
  return `data:image/jpeg;base64,${encode(joined)}`;
}
