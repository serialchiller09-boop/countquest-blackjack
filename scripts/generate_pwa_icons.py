#!/usr/bin/env python3
"""Generate PWA icons (192, 512, apple-touch) for CountQuest branding."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cq_brand_icon import icon_pixel, png_rgb

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        path = OUT / name
        path.write_bytes(png_rgb(size, icon_pixel))
        print(f"Wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())