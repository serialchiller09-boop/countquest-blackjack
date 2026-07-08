"""Load CountQuest web app source (index shell + css + js modules)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

JS_MODULES = [
    "01-constants.js",
    "02-core-types.js",
    "03-counting.js",
    "04-strategy.js",
    "05-help-system.js",
    "06-stats-storage.js",
    "06b-validation.js",
    "07-game-engine.js",
    "08-tutorial.js",
    "09-tests.js",
]


def load_index_html(root: Path | None = None) -> str:
    base = root or ROOT
    return (base / "index.html").read_text(encoding="utf-8")


def load_app_css(root: Path | None = None) -> str:
    base = root or ROOT
    return (base / "css" / "app.css").read_text(encoding="utf-8")


def load_app_js(root: Path | None = None) -> str:
    base = root or ROOT
    chunks = [(base / "js" / name).read_text(encoding="utf-8") for name in JS_MODULES]
    return "\n".join(chunks)


def load_app_source(root: Path | None = None) -> str:
    """Concatenated source used by structure/parity tests."""
    return "\n".join([load_index_html(root), load_app_css(root), load_app_js(root)])