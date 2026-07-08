#!/usr/bin/env python3
"""Run mobile_probe.py and write JSON stdout to a file."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def extract_json(stdout: str) -> dict:
    start = stdout.find("{")
    if start < 0:
        raise ValueError("no JSON object in mobile_probe output")
    depth = 0
    for idx in range(start, len(stdout)):
        ch = stdout[idx]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(stdout[start : idx + 1])
    raise ValueError("unterminated JSON in mobile_probe output")


def main() -> int:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "mobile_probe.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )
    combined = proc.stdout + proc.stderr
    data = extract_json(combined)
    payload = json.dumps(data, indent=2)
    if out_path:
        out_path.write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)
    if proc.returncode != 0 or not data.get("pass"):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())