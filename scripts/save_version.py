"""Read SAVE_VERSION from shipped index.html."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_VERSION_RE = re.compile(r"const\s+SAVE_VERSION\s*=\s*(\d+)")


def read_save_version(html_path: Path | None = None) -> int | None:
    text = (html_path or ROOT / "index.html").read_text(encoding="utf-8")
    match = _VERSION_RE.search(text)
    return int(match.group(1)) if match else None