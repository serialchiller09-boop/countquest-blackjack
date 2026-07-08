"""Stage dist/ — static web bundle for GitHub Pages and Capacitor webDir."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

ASSETS = (
    "index.html",
    "manifest.webmanifest",
    "sw.js",
    ".nojekyll",
)
DIRS = ("css", "js", "icons")


def run(cmd: list[str]) -> None:
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def main() -> int:
    run([sys.executable, "scripts/build_tailwind.py"])
    run([sys.executable, "scripts/generate_pwa_icons.py"])

    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    for name in ASSETS:
        src = ROOT / name
        if src.is_file():
            shutil.copy2(src, DIST / name)

    for dirname in DIRS:
        shutil.copytree(ROOT / dirname, DIST / dirname)

    print(f"Staged {DIST} ({sum(1 for _ in DIST.rglob('*') if _.is_file())} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())