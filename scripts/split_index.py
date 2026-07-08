"""Split monolithic index.html into css/, js/, and a slim index shell."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
CSS_OUT = ROOT / "css" / "app.css"
JS_DIR = ROOT / "js"

JS_SECTIONS = [
    ("01-constants.js", "// §1 CONSTANTS"),
    ("02-core-types.js", "// §2 CORE TYPES"),
    ("03-counting.js", "// §3 CARD COUNTING"),
    ("04-strategy.js", "// §4 BASIC STRATEGY"),
    ("05-help-system.js", "// §5 HELP SYSTEM"),
    ("06-stats-storage.js", "// §6 STATS & STORAGE"),
    ("06b-validation.js", "// §6b INPUT VALIDATION"),
    ("07-game-engine.js", "// §7 GAME ENGINE"),
    ("08-tutorial.js", "// §8 TUTORIAL HELPERS"),
    ("09-tests.js", "// §9 TESTS"),
]


def main() -> None:
    text = INDEX.read_text(encoding="utf-8")
    style_start = text.index("<style>") + len("<style>")
    style_end = text.index("</style>")
    css = text[style_start:style_end].strip("\n") + "\n"

    main_script_marker = '<div id="toast-stack"'
    toast_pos = text.index(main_script_marker)
    script_open = text.index("<script>", toast_pos)
    script_close = text.index("</script>", script_open)
    js_block = text[script_open + len("<script>") : script_close]
    if js_block.startswith("\n"):
        js_block = js_block[1:]

    CSS_OUT.parent.mkdir(parents=True, exist_ok=True)
    JS_DIR.mkdir(parents=True, exist_ok=True)
    CSS_OUT.write_text(css, encoding="utf-8")

    markers = [(name, js_block.index(marker)) for name, marker in JS_SECTIONS]
    for i, (name, start) in enumerate(markers):
        end = markers[i + 1][1] if i + 1 < len(markers) else len(js_block)
        chunk = js_block[start:end].rstrip() + "\n"
        (JS_DIR / name).write_text(chunk, encoding="utf-8")

    head_end = text.index("</head>") + len("</head>")
    body_start = text.index("<body", head_end)
    body_end = script_open
    body = text[body_start:body_end]

    head_prefix = text[: text.index("<style>")]
    script_tags = "\n".join(
        f'  <script src="js/{name}"></script>' for name, _ in JS_SECTIONS
    )
    shell = (
        head_prefix
        + '  <link rel="stylesheet" href="css/app.css" />\n'
        + "</head>\n"
        + body
        + script_tags
        + "\n</body>\n</html>\n"
    )
    INDEX.write_text(shell, encoding="utf-8")
    print(f"Wrote {CSS_OUT.relative_to(ROOT)} ({CSS_OUT.stat().st_size} bytes)")
    for name, _ in JS_SECTIONS:
        path = JS_DIR / name
        print(f"Wrote {path.relative_to(ROOT)} ({path.stat().st_size} bytes)")
    print(f"Wrote slim {INDEX.relative_to(ROOT)} ({INDEX.stat().st_size} bytes)")


if __name__ == "__main__":
    main()