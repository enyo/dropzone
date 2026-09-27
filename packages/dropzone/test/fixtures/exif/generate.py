#!/usr/bin/env python3
"""Generates the EXIF orientation fixtures. Needs Python 3 and ImageMagick 7.

Every fixture *displays* as the same 64x32 image, one colour per quadrant:

    red    green
    blue   yellow

What differs is how it gets there. The pixels are stored transformed by the
inverse of one of the eight EXIF orientations, and the file carries that
orientation, so a viewer that honours it undoes the transform. Each exists
twice, with a big-endian ("MM") and a little-endian ("II") TIFF header, since
cameras write both.

The EXIF block holds Make, Orientation and Software, in that order, so a
reader has to look past the first entry and a writer has to leave its
neighbours alone.

ImageMagick checks the result: every file must auto-orient back to the image
above. That keeps the fixtures independent of both the browser and Dropzone's
own EXIF code.

Run from this directory: python3 generate.py
"""
import struct
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).parent

# The operation that turns the displayed image into the stored one, i.e. the
# inverse of what the orientation asks a viewer to do.
STORE = {
    1: [],
    2: ["-flop"],
    3: ["-rotate", "180"],
    4: ["-flip"],
    5: ["-transpose"],
    6: ["-rotate", "-90"],
    7: ["-transverse"],
    8: ["-rotate", "90"],
}


def magick(*args):
    return subprocess.run(["magick", *args], capture_output=True, check=True).stdout


def exif_segment(orientation, big_endian):
    bo = ">" if big_endian else "<"
    make, software = b"Dropzone\0", b"EXIF fixture\0"
    entries = 3
    data = 8 + 2 + 12 * entries + 4  # where values too big for an entry start
    ifd = struct.pack(bo + "H", entries)
    ifd += struct.pack(bo + "HHII", 0x010F, 2, len(make), data)
    ifd += struct.pack(bo + "HHIHH", 0x0112, 3, 1, orientation, 0)
    ifd += struct.pack(bo + "HHII", 0x0131, 2, len(software), data + len(make))
    ifd += struct.pack(bo + "I", 0)
    tiff = (b"MM" if big_endian else b"II") + struct.pack(bo + "HI", 42, 8) + ifd + make + software
    payload = b"Exif\0\0" + tiff
    return b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload


def quadrants(path):
    colours = []
    for x, y in ((16, 8), (48, 8), (16, 24), (48, 24)):
        r, g, b = (int(v) for v in magick(path, "-format",
                   f"%[fx:int(255*p{{{x},{y}}}.r)] %[fx:int(255*p{{{x},{y}}}.g)] %[fx:int(255*p{{{x},{y}}}.b)]",
                   "info:").split())
        colours.append("Y" if r > 150 and g > 150 and b < 100 else "R" if r > 150
                       else "G" if g > 100 else "B" if b > 150 else "?")
    return "".join(colours)


with tempfile.TemporaryDirectory() as tmp:
    display = Path(tmp) / "display.png"
    magick("-size", "32x16", "xc:#ff0000", "-size", "32x16", "xc:#00c000", "+append",
           "(", "-size", "32x16", "xc:#0000ff", "-size", "32x16", "xc:#ffff00", "+append", ")",
           "-append", str(display))

    for orientation, store in STORE.items():
        for big_endian in (True, False):
            jpeg = magick(str(display), *store, "-quality", "95", "jpg:-")
            assert jpeg[:4] == b"\xff\xd8\xff\xe0", "expected SOI followed by APP0"
            app0_end = 4 + struct.unpack(">H", jpeg[4:6])[0]
            name = HERE / f"{orientation}-{'be' if big_endian else 'le'}.jpg"
            name.write_bytes(jpeg[:app0_end] + exif_segment(orientation, big_endian) + jpeg[app0_end:])

            upright = Path(tmp) / "upright.png"
            magick(str(name), "-auto-orient", str(upright))
            size = magick("identify", "-format", "%wx%h", str(upright)).decode()
            seen = quadrants(str(upright))
            assert (size, seen) == ("64x32", "RGBY"), f"{name.name}: {size} {seen}"
            print(f"{name.name}: orientation {orientation}, displays as {size} {seen}")
