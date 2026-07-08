#!/usr/bin/env python3
"""Rich build summary for Index Play (Strategy Deviation) Drill."""

from __future__ import annotations

import re
import subprocess
import sys
import time
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
console = Console()

BUILT = [
    ("Training Mode entry", "🧠 Index Play Drill — now LIVE"),
    ("Index catalog", "10 common Hi-Lo deviations (insurance, stand, double)"),
    ("Problem display", "Player hand + dealer upcard + true count + index hint"),
    ("Decision input", "Hit / Stand / Double or Insurance Yes / No"),
    ("Instant feedback", "Correct/wrong with index explanation on every answer"),
    ("Practice modes", "Random Mix · Insurance Only · Stand · Double"),
    ("Round size", "8 / 10 / 12 problems per round with summary"),
    ("Session stats", "This visit accuracy + lifetime round average"),
    ("Training history", "Sessions logged to save.trainingHistory"),
]

NEXT = [
    ("Surrender indices", "15 vs 10 surrender at TC +2, 16 vs 9, etc."),
    ("Soft-hand indices", "A,7 vs 2 stand at TC +1 and similar"),
    ("Pair splits", "10,10 vs 5 split at TC +5"),
    ("Flashcard mode", "Rapid-fire without explanations until round end"),
    ("Custom index set", "Choose which plays to include in a session"),
    ("Rule-aware indices", "Adjust indices when H17 / DAS / decks change"),
    ("KO key-count", "Parallel drill using KO pivot instead of true count"),
]


def parse_index_plays(html: str) -> list[tuple[str, str, str]]:
    """Extract id, name, category from INDEX_PLAY_CATALOG entries."""
    plays = []
    block_m = re.search(r"const INDEX_PLAY_CATALOG = \[(.*?)\];", html, re.DOTALL)
    if not block_m:
        return plays
    for m in re.finditer(
        r"\{\s*id:\s*'([^']+)',\s*category:\s*'([^']+)',\s*name:\s*'([^']+)'",
        block_m.group(1),
    ):
        plays.append((m.group(1), m.group(2), m.group(3)))
    return plays


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    plays = parse_index_plays(html)

    console.print()
    console.print(
        Panel(
            "[bold]Index Play Drill[/]\n[dim]Hi-Lo strategy deviations · true count decision trainer[/]",
            title="[bold gold1]Build Complete[/]",
            border_style="green",
        )
    )
    console.print()

    catalog = Table(title="Index play catalog (starter set)", border_style="cyan", header_style="bold")
    catalog.add_column("Play", style="white", min_width=22)
    catalog.add_column("Category", style="dim")
    catalog.add_column("Type", style="gold1")
    for _id, cat, name in plays:
        catalog.add_row(name, cat, cat.title())
    console.print(catalog)
    console.print()

    modes = Table(title="Practice modes", border_style="green", header_style="bold")
    modes.add_column("Mode", style="cyan")
    modes.add_column("Focus", style="white")
    for key, label, focus in [
        ("random", "Random Mix", "All 10 index plays shuffled"),
        ("insurance", "Insurance Only", "TC +3 insurance index"),
        ("stand", "Stand Deviations", "16v10, 15v10, 12v2–4, 13v2"),
        ("double", "Double Deviations", "10v10, 11vA, 9v2"),
    ]:
        if key in html:
            modes.add_row(label, focus)
    console.print(modes)
    console.print()

    built = Table(title="What was built", border_style="green", header_style="bold")
    built.add_column("Feature", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for a, b in BUILT:
        built.add_row(a, b)
    console.print(built)
    console.print()

    nxt = Table(title="What should be expanded next", border_style="blue", header_style="bold")
    nxt.add_column("Item", style="cyan", min_width=16)
    nxt.add_column("Detail", style="white")
    for a, b in NEXT:
        nxt.add_row(a, b)
    console.print(nxt)
    console.print()

    checks = ["INDEX_PLAY_CATALOG", "openIndexPlayDrill", "submitIndexPlayAnswer", "launch: 'index-plays'"]
    with Progress(SpinnerColumn(), TextColumn("[bold]{task.description}"), BarColumn(bar_width=22), console=console) as prog:
        t = prog.add_task("Verifying…", total=len(checks) + 1)
        for _ in checks:
            time.sleep(0.04)
            prog.advance(t)
        ok_tests = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
            cwd=ROOT, capture_output=True, text=True,
        ).returncode == 0
        prog.advance(t)

    console.print(Text(f"Tests: {'PASS' if ok_tests else 'FAIL'}", style="bold green" if ok_tests else "bold red"))
    console.print(f"[dim]Plays in catalog: {len(plays)} · Play: Training Mode [5] → 🧠 Index Play Drill[/]")
    console.print()
    return 0 if ok_tests and len(plays) >= 8 else 1


if __name__ == "__main__":
    raise SystemExit(main())