#!/usr/bin/env python3
"""Generate PWA icons (192, 512, apple-touch) for CountQuest branding."""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"


def _chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def _png_rgb(size: int, draw_fn) -> bytes:
    """Minimal RGB PNG writer (no external deps)."""
    raw_rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            r, g, b = draw_fn(x, y, size)
            row.extend((r, g, b))
        raw_rows.append(bytes(row))
    compressed = zlib.compress(b"".join(raw_rows), 9)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    signature = b"\x89PNG\r\n\x1a\n"
    return signature + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", compressed) + _chunk(b"IEND", b"")


def _pixel(x: int, y: int, size: int) -> tuple[int, int, int]:
    """Gold CQ badge on deep green felt."""
    cx, cy = size / 2, size / 2
    dx, dy = x - cx, y - cy
    dist = math.hypot(dx, dy)
    outer = size * 0.46
    inner_card_w, inner_card_h = size * 0.22, size * 0.30
    r, g, b = 10, 22, 18
    if dist <= outer:
        r, g, b = 20, 61, 40
    if dist <= outer * 0.92:
        r, g, b = 10, 22, 18
    if outer * 0.88 <= dist <= outer * 0.96:
        r, g, b = 245, 158, 11
    if abs(dx) <= inner_card_w / 2 and abs(dy) <= inner_card_h / 2:
        r, g, b = 212, 175, 55
    if abs(dx) <= size * 0.06 and abs(dy) <= size * 0.08:
        r, g, b = 245, 158, 11
    if size * 0.05 <= dx <= size * 0.14 and abs(dy) <= size * 0.08:
        r, g, b = 245, 158, 11
    return r, g, b


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        path = OUT / name
        path.write_bytes(_png_rgb(size, _pixel))
        print(f"Wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())