#!/usr/bin/env python3
"""Generate branded Android/iOS launcher icons and splash screens."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from cq_brand_icon import foreground_pixel, icon_pixel, png_rgb, png_rgb_rect, png_rgba, splash_pixel

ROOT = Path(__file__).resolve().parents[1]
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
IOS_ASSETS = ROOT / "ios" / "App" / "App" / "Assets.xcassets"

MIPMAP_LEGACY = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
MIPMAP_FOREGROUND = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
SPLASH_PORT = {
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (1080, 1920),
    "drawable-port-xxxhdpi": (1280, 1920),
}
SPLASH_LAND = {
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1920, 1080),
    "drawable-land-xxxhdpi": (1920, 1280),
}


def write_launcher_icons() -> None:
    for folder, size in MIPMAP_LEGACY.items():
        out_dir = ANDROID_RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        data = png_rgb(size, icon_pixel)
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            path = out_dir / name
            path.write_bytes(data)
            print(f"Wrote {path.relative_to(ROOT)}")

    for folder, size in MIPMAP_FOREGROUND.items():
        out_dir = ANDROID_RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / "ic_launcher_foreground.png"
        path.write_bytes(png_rgba(size, foreground_pixel))
        print(f"Wrote {path.relative_to(ROOT)}")


def write_splashes() -> None:
    for folder, (w, h) in {**SPLASH_PORT, **SPLASH_LAND}.items():
        out_dir = ANDROID_RES / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / "splash.png"
        path.write_bytes(png_rgb_rect(w, h, splash_pixel))
        print(f"Wrote {path.relative_to(ROOT)}")

    drawable = ANDROID_RES / "drawable" / "splash.png"
    drawable.parent.mkdir(parents=True, exist_ok=True)
    drawable.write_bytes(png_rgb_rect(480, 800, splash_pixel))
    print(f"Wrote {drawable.relative_to(ROOT)}")


def write_ios_assets() -> None:
    app_icon = IOS_ASSETS / "AppIcon.appiconset" / "AppIcon-512@2x.png"
    app_icon.write_bytes(png_rgb(1024, icon_pixel))
    print(f"Wrote {app_icon.relative_to(ROOT)}")

    splash_dir = IOS_ASSETS / "Splash.imageset"
    splash_data = png_rgb_rect(2732, 2732, splash_pixel)
    for name in (
        "splash-2732x2732.png",
        "splash-2732x2732-1.png",
        "splash-2732x2732-2.png",
    ):
        path = splash_dir / name
        path.write_bytes(splash_data)
        print(f"Wrote {path.relative_to(ROOT)}")


def patch_android_background_color() -> None:
    values = ANDROID_RES / "values" / "ic_launcher_background.xml"
    values.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="ic_launcher_background">#0a1612</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )
    print(f"Patched {values.relative_to(ROOT)}")


def main() -> int:
    write_launcher_icons()
    write_splashes()
    write_ios_assets()
    patch_android_background_color()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())