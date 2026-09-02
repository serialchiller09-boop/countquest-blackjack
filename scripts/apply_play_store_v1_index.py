#!/usr/bin/env python3
"""Patch index.html for Play Store stamps: v47 stamps, ?dev=1, first-run script tag."""
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

text = text.replace("?v=46", "?v=47")
text = text.replace(">v46<", ">v47<")

if "js/11-first-run.js" not in text:
    needle = '<script src="js/09-tests.js?v=47"></script>'
    text = text.replace(
        needle,
        needle + '\n  <script src="js/11-first-run.js?v=47"></script>',
        1,
    )

if "css/play-store-v1.css" not in text:
    text = text.replace(
        '<link rel="stylesheet" href="css/casino-felt-table.css?v=47" />',
        '<link rel="stylesheet" href="css/casino-felt-table.css?v=47" />\n  <link rel="stylesheet" href="css/play-store-v1.css?v=47" />',
        1,
    )

if text == orig:
    print("index.html already patched")
else:
    path.write_text(text, encoding="utf-8")
    print("patched", path)
