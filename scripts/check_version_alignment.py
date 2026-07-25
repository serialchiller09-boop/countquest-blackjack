#!/usr/bin/env python3
"""Fail if build stamp, cache busters, Android versionCode, and SW drift."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def main() -> int:
    errors: list[str] = []
    index = read(ROOT / "index.html")
    gradle = read(ROOT / "android" / "app" / "build.gradle")
    sw = read(ROOT / "sw.js")

    stamp_m = re.search(r'id="cq-build-stamp"[^>]*>v(\d+)<', index)
    if not stamp_m:
        errors.append("index.html: missing #cq-build-stamp vN")
    else:
        stamp = int(stamp_m.group(1))
        code_m = re.search(r"versionCode\s+(\d+)", gradle)
        if not code_m:
            errors.append("build.gradle: missing versionCode")
        elif int(code_m.group(1)) != stamp:
            errors.append(f"versionCode {code_m.group(1)} != build stamp v{stamp}")

        busters = set(re.findall(r"\?v=(\d+)", index))
        if len(busters) != 1:
            errors.append(f"index.html: inconsistent ?v= cache busters: {sorted(busters)}")
        elif busters and int(next(iter(busters))) != stamp:
            errors.append(f"cache buster ?v= != build stamp v{stamp}")

    if "casino-felt-table.css" not in sw:
        errors.append("sw.js: casino-felt-table.css not in SHELL_ASSETS")

    lobby_m = re.search(r'id="lobby-build-stamp"[^>]*>v(\d+)<', index)
    if lobby_m and stamp_m and lobby_m.group(1) != stamp_m.group(1):
        errors.append(f"lobby-build-stamp v{lobby_m.group(1)} != cq-build-stamp v{stamp_m.group(1)}")

    if errors:
        print("VERSION ALIGNMENT FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print(f"OK: aligned at v{stamp_m.group(1) if stamp_m else '?'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())