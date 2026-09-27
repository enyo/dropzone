// The two things Dropzone needs from a JPEG's EXIF.
//
// Its orientation. Cameras store pixels the way the sensor read them and
// record in EXIF how to turn them upright. Dropzone applies that itself when
// drawing, rather than leaving it to the browser, so that the result does not
// depend on which browser it is -- older ones do not do it at all.
//
// And the rest of it. A canvas cannot write metadata, so when `resizeImage`
// re-encodes a photo, the camera's EXIF -- date taken, make and model,
// location -- would be lost. That gets copied across from the original.
//
// Both work on the base64 of the data URLs directly, since that is what the
// images are at that point.

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
// them. `chars` is how much of the base64 that was: all of it, or a whole
// number of groups whose bytes can be re-encoded and put back in its place.
function readHead(base64: string) {
  let chars = Math.min(base64.length, (HEAD_BYTES / 3) * 4);
  let bytes = decode(base64.slice(0, chars));
  let segments = segmentsOf(bytes);
  if (segments == null && chars < base64.length) {
    chars = base64.length;
    bytes = decode(base64);
    segments = segmentsOf(bytes);
  }
  return { bytes, segments: segments || [], chars };
}

// Whether a segment holds EXIF: an APP1 that starts "Exif\0\0". XMP uses APP1
// as well.
function isExif(bytes: Uint8Array, segment: Segment): boolean {
  let signature = "Exif\0\0";
  for (let i = 0; i < signature.length; i++) {
    if (bytes[segment.start + 4 + i] !== signature.charCodeAt(i)) {
      return false;
    }
  }
  return segment.marker === APP1;
}

// Where the Orientation value of an EXIF segment sits, and what it says, or
// null if the segment is not EXIF or has none. Everything read is checked
// against the segment's end first, since the file is whatever the user
// dropped.
function orientationOf(bytes: Uint8Array, segment: Segment) {
  let end = segment.end;
  let tiff = segment.start + 10; // after the marker, the length and "Exif\0\0"
  if (!isExif(bytes, segment) || tiff + 8 > end) {
    return null;
  }

  // The TIFF header says which byte order everything after it is in.
  let little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  if (!little && !(bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d)) {
    return null;
  }
  let u16 = (at: number) =>
    little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1];
  let u32 = (at: number) =>
    little ? u16(at) + u16(at + 2) * 0x10000 : u16(at) * 0x10000 + u16(at + 2);
  if (u16(tiff + 2) !== 42) {
    return null;
  }

  let ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) {
    return null;
  }
  for (let i = 0, count = u16(ifd); i < count; i++) {
    let entry = ifd + 2 + 12 * i;
    if (entry + 12 > end) {
      return null;
    }
    // Orientation is a single SHORT, so its value sits in the entry itself.
    if (u16(entry) === 0x0112) {
      return u16(entry + 2) === 3 ? { at: entry + 8, little, value: u16(entry + 8) } : null;
    }
  }
  return null;
}

// A data URL's orientation, and the data URL with its orientation set to 1,
// so that the browser draws the pixels as they are stored instead of turning
// them itself. Only the two bytes of the value change.
//
// Anything that is not a JPEG, or does not ask to be turned, comes back as it
// is with orientation 1 -- the same string, so no copy of the image is made.
// It never throws; the worst case is that the browser decides after all.
export function extractOrientation(dataURL: string): { url: string; orientation: number } {
  let unchanged = { url: dataURL, orientation: 1 };
  try {
    let comma = dataURL.indexOf(",");
    let prefix = dataURL.slice(0, comma + 1);
    if (!prefix.startsWith("data:") || !prefix.endsWith(";base64,")) {
      return unchanged;
    }
    let base64 = dataURL.slice(comma + 1);

    let head = readHead(base64);
    // Browsers read it from the first EXIF segment and look no further.
    let exif = head.segments.find((segment) => isExif(head.bytes, segment));
    let found = exif ? orientationOf(head.bytes, exif) : null;
    // Values outside 1 to 8 mean nothing, and browsers treat them as 1.
    if (found == null || found.value < 2 || found.value > 8) {
      return unchanged;
    }

    let bytes = head.bytes.slice();
    bytes[found.at] = found.little ? 1 : 0;
    bytes[found.at + 1] = found.little ? 0 : 1;
    return { url: prefix + encode(bytes) + base64.slice(head.chars), orientation: found.value };
  } catch (error) {
    return unchanged;
  }
}

type Rect = { x: number; y: number; width: number; height: number };

// A rectangle of an image as it is displayed, found in its pixels as they are
// stored. `width` and `height` are the displayed image's.
export function storedRect(orientation: number, width: number, height: number, rect: Rect): Rect {
  let { x, y, width: w, height: h } = rect;
  // How far the rectangle is from the displayed image's right and bottom.
  let right = width - x - w;
  let bottom = height - y - h;
  // Orientations 5 to 8 put the image on its side, which swaps the axes.
  switch (orientation) {
    case 2:
      return { x: right, y, width: w, height: h };
    case 3:
      return { x: right, y: bottom, width: w, height: h };
    case 4:
      return { x, y: bottom, width: w, height: h };
    case 5:
      return { x: y, y: x, width: h, height: w };
    case 6:
      return { x: y, y: right, width: h, height: w };
    case 7:
      return { x: bottom, y: right, width: h, height: w };
    case 8:
      return { x: bottom, y: x, width: h, height: w };
    default:
      return rect;
  }
}

// The canvas transform that makes stored pixels, drawn from the origin, fill
// a `width` by `height` rectangle the right way up. For 5 to 8 they have to
// be drawn `height` wide and `width` high, since they are on their side.
export function orientationTransform(
  orientation: number,
  width: number,
  height: number,
): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2: // mirrored left to right
      return [-1, 0, 0, 1, width, 0];
    case 3: // upside down
      return [-1, 0, 0, -1, width, height];
    case 4: // mirrored top to bottom
      return [1, 0, 0, -1, 0, height];
    case 5: // mirrored along the diagonal from top left
      return [0, 1, 1, 0, 0, 0];
    case 6: // turned a quarter to the left, so turn it right
      return [0, 1, -1, 0, width, 0];
    case 7: // mirrored along the other diagonal
      return [0, -1, -1, 0, width, height];
    case 8: // turned a quarter to the right, so turn it left
      return [0, -1, 1, 0, 0, height];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
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
  } catch (error) {
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
  if (target[0] !== 0xff || target[1] !== SOI) {
    return resized;
  }
  // After the JFIF header when there is one, since that has to come first,
  // and straight after the start-of-image marker otherwise.
  let segments = segmentsOf(target);
  let at = segments && segments.length && segments[0].marker === APP0 ? segments[0].end : 2;

  let joined = new Uint8Array(target.length + block.length);
  joined.set(target.subarray(0, at));
  joined.set(block, at);
  joined.set(target.subarray(at), at + block.length);
  return `data:image/jpeg;base64,${encode(joined)}`;
}
