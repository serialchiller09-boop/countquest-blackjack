"""CountQuest brand icon drawing — gold CQ badge on deep green felt."""

from __future__ import annotations

import math
import struct
import zlib

FELT_BG = (10, 22, 18)
FELT_RING = (20, 61, 40)
GOLD = (245, 158, 11)
GOLD_SOFT = (212, 175, 55)


def badge_rgb(x: int, y: int, size: int) -> tuple[int, int, int] | None:
    """Return badge pixel RGB or None for transparent/outside badge."""
    cx, cy = size / 2, size / 2
    dx, dy = x - cx, y - cy
    dist = math.hypot(dx, dy)
    outer = size * 0.46
    inner_card_w, inner_card_h = size * 0.22, size * 0.30
    if dist > outer:
        return None
    r, g, b = FELT_RING
    if dist <= outer * 0.92:
        r, g, b = FELT_BG
    if outer * 0.88 <= dist <= outer * 0.96:
        r, g, b = GOLD
    if abs(dx) <= inner_card_w / 2 and abs(dy) <= inner_card_h / 2:
        r, g, b = GOLD_SOFT
    if abs(dx) <= size * 0.06 and abs(dy) <= size * 0.08:
        r, g, b = GOLD
    if size * 0.05 <= dx <= size * 0.14 and abs(dy) <= size * 0.08:
        r, g, b = GOLD
    return r, g, b


def icon_pixel(x: int, y: int, size: int) -> tuple[int, int, int]:
    return badge_rgb(x, y, size) or FELT_BG


def foreground_pixel(x: int, y: int, size: int) -> tuple[int, int, int, int]:
    rgb = badge_rgb(x, y, size)
    if rgb is None:
        return (0, 0, 0, 0)
    return (*rgb, 255)


def splash_pixel(x: int, y: int, width: int, height: int) -> tuple[int, int, int]:
    badge_size = int(min(width, height) * 0.42)
    ox = (width - badge_size) // 2
    oy = (height - badge_size) // 2
    lx, ly = x - ox, y - oy
    if 0 <= lx < badge_size and 0 <= ly < badge_size:
        rgb = badge_rgb(lx, ly, badge_size)
        if rgb is not None:
            return rgb
    return FELT_BG


def _chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def png_rgb(size: int, draw_fn) -> bytes:
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


def png_rgba(size: int, draw_fn) -> bytes:
    raw_rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            r, g, b, a = draw_fn(x, y, size)
            row.extend((r, g, b, a))
        raw_rows.append(bytes(row))
    compressed = zlib.compress(b"".join(raw_rows), 9)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    signature = b"\x89PNG\r\n\x1a\n"
    return signature + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", compressed) + _chunk(b"IEND", b"")


def png_rgb_rect(width: int, height: int, draw_fn) -> bytes:
    raw_rows = []
    for y in range(height):
        row = bytearray([0])
        for x in range(width):
            r, g, b = draw_fn(x, y, width, height)
            row.extend((r, g, b))
        raw_rows.append(bytes(row))
    compressed = zlib.compress(b"".join(raw_rows), 9)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    signature = b"\x89PNG\r\n\x1a\n"
    return signature + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", compressed) + _chunk(b"IEND", b"")