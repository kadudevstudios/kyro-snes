#!/usr/bin/env python3
"""Generates the app icon (PNG + ICO) with no third-party dependencies."""

import struct
import zlib
import os

SIZE = 256
BG_TOP = (255, 107, 115)
BG_BOTTOM = (165, 20, 28)
FG = (255, 255, 255)


def lerp(a, b, t):
    return int(round(a + (b - a) * t))


def inside_rounded(x, y, radius):
    if radius <= x < SIZE - radius or radius <= y < SIZE - radius:
        return 0 <= x < SIZE and 0 <= y < SIZE
    cx = radius if x < radius else SIZE - radius - 1
    cy = radius if y < radius else SIZE - radius - 1
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def in_rect(x, y, x0, y0, x1, y1):
    return x0 <= x < x1 and y0 <= y < y1


def in_k(x, y):
    # Vertical stem
    if in_rect(x, y, 78, 62, 110, 194):
        return True
    # Upper diagonal
    if in_rect(x, y, 110, 62, 182, 194):
        t = (x - 110) / 72.0
        center = 128 - 58 * t
        if abs(y - center) <= 20 and t <= 1:
            return True
    # Lower diagonal
    if in_rect(x, y, 110, 62, 182, 194):
        t = (x - 110) / 72.0
        center = 128 + 58 * t
        if abs(y - center) <= 20 and t <= 1:
            return True
    return False


def build_rgba():
    rows = []
    radius = 56
    for y in range(SIZE):
        row = bytearray()
        for x in range(SIZE):
            if not inside_rounded(x, y, radius):
                row += bytes((0, 0, 0, 0))
                continue
            t = y / (SIZE - 1)
            r = lerp(BG_TOP[0], BG_BOTTOM[0], t)
            g = lerp(BG_TOP[1], BG_BOTTOM[1], t)
            b = lerp(BG_TOP[2], BG_BOTTOM[2], t)
            if in_k(x, y):
                r, g, b = FG
            row += bytes((r, g, b, 255))
        rows.append(bytes(row))
    return rows


def write_png(path, rows):
    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(png)
    return png


def write_ico(path, png_bytes):
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack(
        "<BBBBHHII",
        0, 0, 0, 0, 1, 32, len(png_bytes), 22,
    )
    with open(path, "wb") as handle:
        handle.write(header + entry + png_bytes)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.abspath(os.path.join(here, "..", "desktop", "build"))
    os.makedirs(build_dir, exist_ok=True)
    rows = build_rgba()
    png = write_png(os.path.join(build_dir, "icon.png"), rows)
    write_ico(os.path.join(build_dir, "icon.ico"), png)
    print("icon.png / icon.ico gerados em", build_dir)


if __name__ == "__main__":
    main()
