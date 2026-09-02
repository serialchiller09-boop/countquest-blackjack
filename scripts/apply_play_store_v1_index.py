#!/usr/bin/env python3
"""Patch index.html for Play Store v1: v46 stamps, ?dev=1, first-run script tag."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "index.html"
text = path.read_text(encoding="utf-8")
orig = text

if "window.__CQ_DEV_MODE" not in text:
    text = text.replace(
        "    window.__CQ_TEST_MODE = /[?&]test(?:=|&|$)/.test(location.search);\n",
        "    window.__CQ_TEST_MODE = /[?&]test(?:=|&|$)/.test(location.search);\n"
        "    window.__CQ_DEV_MODE = /[?&]dev=1(?:&|$)/.test(location.search);\n",
        1,
    )
    text = text.replace(
        "    if (window.__CQ_TEST_MODE) { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} }\n",
        "    if (window.__CQ_DEV_MODE) document.documentElement.classList.add('cq-dev');\n"
        "    if (window.__CQ_TEST_MODE) { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} }\n",
        1,
    )

text = text.replace("?v=45", "?v=46")
text = text.replace(">v45<", ">v46<")

if "js/11-first-run.js" not in text:
    needle = '<script src="js/09-tests.js?v=46"></script>'
    text = text.replace(
        needle,
        needle + '\n  <script src="js/11-first-run.js?v=46"></script>',
        1,
    )

if text == orig:
    print("index.html already patched")
else:
    path.write_text(text, encoding="utf-8")
    print("patched", path)
