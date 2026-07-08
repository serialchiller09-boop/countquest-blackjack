"""Build css/tailwind.css from css/tailwind-src.css using the Tailwind standalone CLI."""

from __future__ import annotations

import platform
import stat
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
VERSION = "v3.4.17"
ASSETS = {
    "Windows": ("tailwindcss-windows-x64.exe", "tailwindcss.exe"),
    "Linux": ("tailwindcss-linux-x64", "tailwindcss"),
    "Darwin": ("tailwindcss-macos-x64", "tailwindcss"),
}


def cli_path() -> Path:
    system = platform.system()
    if system not in ASSETS:
        raise RuntimeError(f"Unsupported platform for Tailwind standalone CLI: {system}")
    asset, name = ASSETS[system]
    dest = TOOLS / name
    if dest.exists():
        return dest
    TOOLS.mkdir(parents=True, exist_ok=True)
    url = f"https://github.com/tailwindlabs/tailwindcss/releases/download/{VERSION}/{asset}"
    print(f"Downloading {url} …")
    urllib.request.urlretrieve(url, dest)
    if system != "Windows":
        dest.chmod(dest.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return dest


def main() -> int:
    cli = cli_path()
    cmd = [
        str(cli),
        "-i",
        "css/tailwind-src.css",
        "-o",
        "css/tailwind.css",
        "--minify",
    ]
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)
    out = ROOT / "css" / "tailwind.css"
    print(f"Wrote {out} ({out.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())