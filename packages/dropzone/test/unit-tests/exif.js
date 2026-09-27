import { Dropzone } from "../../src/dropzone";
import { extractOrientation, restoreExif } from "../../src/exif";

// Every fixture displays as the same 64x32 image, one colour per quadrant --
// red, green / blue, yellow -- but stores its pixels transformed by the inverse
// of an EXIF orientation. See ../fixtures/exif/generate.py.
const fixtures = Object.entries(
  import.meta.glob("../fixtures/exif/*.jpg", { query: "?inline", import: "default", eager: true }),
).map(([path, url]) => {
  let [, orientation, byteOrder] = path.match(/(\d)-(be|le)\.jpg$/);
  return { name: `${orientation}-${byteOrder}`, orientation: Number(orientation), url };
});

let bytesOf = (url) =>
  Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (char) => char.charCodeAt(0));

function jpegUrlOf(bytes) {
  let binary = "";
  for (let byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

let fileOf = ({ name, url }) => new File([bytesOf(url)], `${name}.jpg`, { type: "image/jpeg" });

let dataUrlOf = (blob) =>
  new Promise((resolve) => {
    let reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

// What an image looks like once the browser has decoded it: its size, and the
// colour at the centre of each quadrant.
async function looks(src) {
  let img = await new Promise((resolve, reject) => {
    let img = document.createElement("img");
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  let { naturalWidth: width, naturalHeight: height } = img;
  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  let colours = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ].map(([fx, fy]) => {
    let [r, g, b] = ctx.getImageData(Math.floor(width * fx), Math.floor(height * fy), 1, 1).data;
    if (r > 150 && g > 150 && b < 100) return "Y";
    if (r > 150) return "R";
    if (g > 100) return "G";
    if (b > 150) return "B";
    return "?";
  });
  return `${width}x${height} ${colours.join("")}`;
}

// A viewer that ignores EXIF shows the stored pixels as they are. Dropping the
// APP1 segments gets the browser to do the same.
function withoutExif(url) {
  let bytes = bytesOf(url);
  let kept = [bytes.subarray(0, 2)];
  let p = 2;
  while (p + 4 <= bytes.length && bytes[p] === 0xff && bytes[p + 1] !== 0xda) {
    let end = p + 2 + ((bytes[p + 2] << 8) | bytes[p + 3]);
    if (bytes[p + 1] !== 0xe1) kept.push(bytes.subarray(p, end));
    p = end;
  }
  kept.push(bytes.subarray(p));

  let joined = new Uint8Array(kept.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (let part of kept) {
    joined.set(part, offset);
    offset += part.length;
  }
  return jpegUrlOf(joined);
}

// Orientation and Make, read without going through Dropzone's own EXIF code.
// It only has to cope with the fixtures and what a canvas writes.
function exifOf(url) {
  let b = bytesOf(url);
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff && b[p + 1] !== 0xda) {
    let isExif = String.fromCharCode(...b.subarray(p + 4, p + 10)) === "Exif\0\0";
    if (b[p + 1] === 0xe1 && isExif) {
      let tiff = p + 10;
      let little = b[tiff] === 0x49;
      let u16 = (o) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
      let u32 = (o) => (little ? u16(o) + u16(o + 2) * 65536 : u16(o) * 65536 + u16(o + 2));
      let ifd = tiff + u32(tiff + 4);
      let tags = {};
      for (let i = 0; i < u16(ifd); i++) {
        let entry = ifd + 2 + 12 * i;
        let count = u32(entry + 4);
        if (u16(entry) === 0x0112) tags.orientation = u16(entry + 8);
        if (u16(entry) === 0x010f) {
          let at = count > 4 ? tiff + u32(entry + 8) : entry + 8;
          tags.make = String.fromCharCode(...b.subarray(at, at + count - 1));
        }
      }
      return tags;
    }
    p += 2 + ((b[p + 2] << 8) | b[p + 3]);
  }
  return null;
}

describe("EXIF orientation", function () {
  let dropzone = null;
  beforeEach(() => (dropzone = new Dropzone(document.createElement("div"), { url: "/" })));
  afterEach(() => dropzone.destroy());

  let thumbnail = (file, width, height, method) =>
    new Promise((resolve) => dropzone.createThumbnail(file, width, height, method, true, resolve));

  let resize = (file, width, height, method) =>
    new Promise((resolve) => dropzone.resizeImage(file, width, height, method, resolve)).then(
      dataUrlOf,
    );

  describe.each(fixtures)("orientation $orientation ($name)", (fixture) => {
    it("should draw the thumbnail upright", async function () {
      let file = fileOf(fixture);

      expect(await looks(await thumbnail(file, 32, 32, "contain"))).toBe("32x16 RGBY");
      // The dimensions are the displayed ones, which is what `resize` and
      // anyone reading them in a `thumbnail` handler work with.
      expect([file.width, file.height]).toEqual([64, 32]);
    });

    it("should resize along the displayed axes", async function () {
      let resized = await resize(fileOf(fixture), 32, null, "contain");

      // `resizeWidth` limits the width the image is shown at, whichever way
      // round its pixels are stored.
      expect(await looks(withoutExif(resized))).toBe("32x16 RGBY");
    });

    it("should crop along the displayed axes", async function () {
      let resized = await resize(fileOf(fixture), 32, 32, "crop");

      expect(await looks(withoutExif(resized))).toBe("32x32 RGBY");
    });

    it("should take a custom resize's source rectangle from the displayed image", async function () {
      // Off-centre on purpose: the default `resize` only ever crops around the
      // middle, which looks the same however the image is flipped.
      dropzone.options.resize = () => ({
        srcX: 32,
        srcY: 0,
        srcWidth: 32,
        srcHeight: 16,
        trgWidth: 32,
        trgHeight: 16,
      });

      expect(await looks(await thumbnail(fileOf(fixture), null, null, "contain"))).toBe(
        "32x16 GGGG",
      );
    });

    it("should carry the original EXIF over to the resized image", async function () {
      let resized = await resize(fileOf(fixture), 32, null, "contain");

      expect(exifOf(resized)).toEqual({ orientation: fixture.orientation, make: "Dropzone" });
    });
  });

  it("should leave an image from the server for the browser to orient", async function () {
    let { url } = fixtures.find((fixture) => fixture.name === "6-be");

    let shown = await new Promise((resolve) => {
      dropzone.on("thumbnail", (file, dataUrl) => resolve(dataUrl));
      dropzone.displayExistingFile({ name: "photo.jpg", size: 1 }, url, null, null, true);
    });

    expect(await looks(shown)).toBe("64x32 RGBY");
  });

  it("should leave a PNG alone", async function () {
    let canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 32;
    let ctx = canvas.getContext("2d");
    for (let [colour, x, y] of [
      ["#ff0000", 0, 0],
      ["#00c000", 32, 0],
      ["#0000ff", 0, 16],
      ["#ffff00", 32, 16],
    ]) {
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 32, 16);
    }
    let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    let png = new File([blob], "upright.png", { type: "image/png" });

    expect(await looks(await thumbnail(png, 32, 32, "contain"))).toBe("32x16 RGBY");
    expect(await looks(await resize(png, 32, null, "contain"))).toBe("32x16 RGBY");
  });
});

// Just enough of a JPEG for the segment handling: markers and lengths are
// real, the contents are not.
let segment = (marker, payload) => {
  let length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
};
let text = (string) => Array.from(string, (char) => char.charCodeAt(0));
let jpeg = (...segments) =>
  jpegUrlOf(Uint8Array.from([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0, 2, 0x12, 0xff, 0xd9]));

const JFIF = segment(0xe0, text("JFIF\0\x01\x01\0\0\x01\0\x01\0\0"));
const EXIF = segment(0xe1, text("Exif\0\0MM\0*\0\0\0\x08\0\0"));
const XMP = segment(0xe1, text("http://ns.adobe.com/xap/1.0/\0<x/>"));
// A quantisation table full of 0xFF, which is not a marker in there.
const TABLE = segment(0xdb, [0, ...Array(64).fill(0xff)]);

describe("restoreExif()", function () {
  it("should put the EXIF segment after the JFIF header", function () {
    expect(restoreExif(jpeg(JFIF, EXIF, TABLE), jpeg(JFIF, TABLE))).toBe(jpeg(JFIF, EXIF, TABLE));
  });

  it("should put it straight after the start of image when there is no JFIF header", function () {
    expect(restoreExif(jpeg(JFIF, EXIF, TABLE), jpeg(TABLE))).toBe(jpeg(EXIF, TABLE));
  });

  it("should take the first APP1 segment, whatever it holds", function () {
    expect(restoreExif(jpeg(JFIF, XMP, EXIF), jpeg(JFIF, TABLE))).toBe(jpeg(JFIF, XMP, TABLE));
  });

  it("should find EXIF past the part of the file it decodes first", function () {
    // Four segments of the largest size there is push it past 192 KiB.
    let large = segment(0xe2, Array(65533).fill(0));
    let original = jpeg(JFIF, large, large, large, large, EXIF, TABLE);

    expect(restoreExif(original, jpeg(JFIF, TABLE))).toBe(jpeg(JFIF, EXIF, TABLE));
  });

  it("should hand the resized image back as it is when the original has no EXIF", function () {
    let resized = jpeg(JFIF, TABLE);

    expect(restoreExif(jpeg(JFIF, TABLE), resized)).toBe(resized);
  });

  it("should hand the resized image back as it is if the original cannot be decoded", function () {
    let resized = jpeg(JFIF, TABLE);

    expect(restoreExif("data:image/jpeg;base64,not*base64", resized)).toBe(resized);
  });

  it("should hand the resized image back as it is unless both are JPEGs", function () {
    let png = "data:image/png;base64,iVBORw0KGgo=";
    let resized = jpeg(JFIF, TABLE);

    expect(restoreExif(png, resized)).toBe(resized);
    expect(restoreExif(jpeg(JFIF, EXIF, TABLE), png)).toBe(png);
  });
});

// An EXIF segment holding nothing but an orientation, written without going
// through Dropzone. `null` leaves the tag out; `type` other than 3 (SHORT)
// makes it malformed.
function exifSegment(orientation, { little = false, type = 3, entries = null } = {}) {
  let u16 = (v) => (little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  let u32 = (v) =>
    little ? [...u16(v & 0xffff), ...u16(v >>> 16)] : [...u16(v >>> 16), ...u16(v & 0xffff)];
  let tags =
    orientation == null
      ? []
      : [[...u16(0x0112), ...u16(type), ...u32(1), ...u16(orientation), 0, 0]];
  let ifd = [...u16(entries ?? tags.length), ...tags.flat(), ...u32(0)];
  return segment(0xe1, [
    ...text("Exif\0\0"),
    ...text(little ? "II" : "MM"),
    ...u16(42),
    ...u32(8),
    ...ifd,
  ]);
}

// Which bytes differ between two data URLs of the same length.
function changedBytes(before, after) {
  let [a, b] = [bytesOf(before), bytesOf(after)];
  expect(b.length).toBe(a.length);
  return a.reduce((changed, byte, i) => (byte === b[i] ? changed : [...changed, i]), []);
}

describe("extractOrientation()", function () {
  let fixture = (name) => fixtures.find((f) => f.name === name).url;

  it.each(["2-be", "3-le", "5-be", "6-be", "6-le", "7-le", "8-be"])(
    "should report %s's orientation and set it to 1, changing nothing else",
    function (name) {
      let { url, orientation } = extractOrientation(fixture(name));

      expect(orientation).toBe(Number(name[0]));
      expect(exifOf(url)).toEqual({ orientation: 1, make: "Dropzone" });
      // Only the low byte of the value, whichever end of the SHORT that is.
      expect(changedBytes(fixture(name), url)).toHaveLength(1);
    },
  );

  it("should hand back the very same string when there is nothing to turn", function () {
    let upright = fixture("1-be");

    expect(extractOrientation(upright)).toEqual({ url: upright, orientation: 1 });
  });

  it("should leave a JPEG without an orientation alone", function () {
    for (let url of [
      jpeg(JFIF, TABLE),
      jpeg(JFIF, exifSegment(null), TABLE),
      jpeg(JFIF, XMP, TABLE),
    ]) {
      expect(extractOrientation(url)).toEqual({ url, orientation: 1 });
    }
  });

  it("should only look at the first EXIF segment, as browsers do", function () {
    let url = jpeg(exifSegment(null), exifSegment(6), TABLE);

    expect(extractOrientation(url)).toEqual({ url, orientation: 1 });
  });

  it("should ignore values that mean nothing, as browsers do", function () {
    for (let url of [
      jpeg(exifSegment(0), TABLE),
      jpeg(exifSegment(9), TABLE),
      jpeg(exifSegment(6, { type: 4 }), TABLE),
    ]) {
      expect(extractOrientation(url)).toEqual({ url, orientation: 1 });
    }
  });

  it("should leave anything that is not a base64 JPEG alone", function () {
    for (let url of [
      "data:image/png;base64,iVBORw0KGgo=",
      "data:image/jpeg,not-base64",
      "https://example.com/photo.jpg",
    ]) {
      expect(extractOrientation(url)).toEqual({ url, orientation: 1 });
    }
  });

  it("should give up quietly on a broken file", function () {
    let brokenOrder = exifSegment(6);
    brokenOrder.splice(10, 2, 0x58, 0x58); // "XX" instead of "MM"

    for (let url of [
      // Claims five entries, holds none: reading them would run off the end
      // of the segment and into the table after it.
      jpeg(exifSegment(null, { entries: 5 }), TABLE),
      jpeg(brokenOrder, TABLE),
      // A segment longer than the file.
      jpegUrlOf(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x10, 0x00, 0x45])),
      "data:image/jpeg;base64,not*base64",
    ]) {
      expect(extractOrientation(url)).toEqual({ url, orientation: 1 });
    }
  });

  it("should find the orientation past the part of the file it decodes first", function () {
    // Four segments of the largest size there is push it past 192 KiB.
    let large = segment(0xe2, Array(65533).fill(0));
    let original = jpeg(JFIF, large, large, large, large, exifSegment(6), TABLE);

    let { url, orientation } = extractOrientation(original);

    expect(orientation).toBe(6);
    expect(changedBytes(original, url)).toHaveLength(1);
  });

  it("should re-encode only the head of a large file and leave the rest as it was", function () {
    // Large enough that only its head gets decoded; the base64 of the rest
    // must be carried over as it is and still line up.
    let scan = Uint8Array.from({ length: 400000 }, (_, i) => (i * 7) % 255);
    let head = [
      0xff,
      0xd8,
      ...JFIF,
      ...exifSegment(6, { little: true }),
      ...TABLE,
      0xff,
      0xda,
      0,
      2,
    ];
    let bytes = new Uint8Array(head.length + scan.length + 2);
    bytes.set(head);
    bytes.set(scan, head.length);
    bytes.set([0xff, 0xd9], head.length + scan.length);
    let original = jpegUrlOf(bytes);

    let { url, orientation } = extractOrientation(original);

    expect(orientation).toBe(6);
    expect(changedBytes(original, url)).toHaveLength(1);
    expect(url.slice(-1000)).toBe(original.slice(-1000));
  });
});
