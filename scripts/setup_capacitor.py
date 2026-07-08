"""One-time / refresh Capacitor native platforms (requires Node.js + npm)."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NPM = "npm.cmd" if sys.platform == "win32" else "npm"
NPX = "npx.cmd" if sys.platform == "win32" else "npx"


def run(cmd: list[str]) -> None:
    print("Running:", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def main() -> int:
    if not shutil.which("node"):
        print("Node.js is required. Install from https://nodejs.org/ then re-run.", file=sys.stderr)
        return 1

    run([NPM, "install"])
    run([sys.executable, "scripts/stage_dist.py"])

    android = ROOT / "android"
    ios = ROOT / "ios"
    if not android.is_dir():
        run([NPX, "cap", "add", "android"])
    if not ios.is_dir():
        run([NPX, "cap", "add", "ios"])

    run([NPX, "cap", "sync"])
    print("\nCapacitor ready.")
    print("  Android Studio: npm run cap:android")
    print("  Xcode (macOS):  npm run cap:ios")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())