"""Read SAVE_VERSION from shipped index.html."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_VERSION_RE = re.compile(r"const\s+SAVE_VERSION\s*=\s*(\d+)")


def read_save_version(html_path: Path | None = None) -> int | None:
    if html_path is not None:
        text = html_path.read_text(encoding="utf-8")
    else:
        constants = ROOT / "js" / "01-constants.js"
        legacy = ROOT / "index.html"
        text = constants.read_text(encoding="utf-8") if constants.is_file() else legacy.read_text(encoding="utf-8")
    match = _VERSION_RE.search(text)
    return int(match.group(1)) if match else None