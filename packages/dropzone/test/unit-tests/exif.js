import { Dropzone } from "../../src/dropzone";

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
