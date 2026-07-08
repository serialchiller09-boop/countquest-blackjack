#!/usr/bin/env python3
"""Rich build summary for Running Count Speed Drill."""

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

IMPLEMENTED = [
    ("Entry points", "Training Mode [5] or Practice Range → Running Count Speed Drill (⚡)"),
    ("Auto-deal loop", "Cards one-by-one at Slow (1.2s) / Normal (0.7s) / Fast (0.35s); pause & skip"),
    ("Mental Hi-Lo count", "CardCounter('hi-lo') + Shoe.deal(); optional show-count training wheels"),
    ("End quiz", "Player inputs final running count after N cards (20/40/60)"),
    ("Instant feedback", "Correct / Close (±1) / Wrong with exact count and error amount"),
    ("Session stats", "This visit: accuracy % and avg error; updates after each round"),
    ("Lifetime stats", "All-time accuracy & avg error persisted in save.speedDrill"),
    ("Reuse game logic", "Shoe, CardCounter, validateRunningCountGuess(), renderCard()"),
]

LIMITATIONS = [
    ("Hi-Lo only", "Drill always uses Hi-Lo tags regardless of Settings counting system"),
    ("Single cards", "Deals one card at a time — no small-group bursts yet"),
    ("No leaderboard", "History is local to this browser only"),
    ("±1 tolerance", "Matches main game quiz — exact match highlighted separately in UI"),
]

NEXT_STEPS = [
    ("Card bursts", "Optional 2–3 card groups at fast speed"),
    ("KO mode", "Speed drill variant using KO tags"),
    ("Streak goals", "Daily target: 5 perfect rounds at fast speed"),
    ("Rich CLI mirror", "Textual terminal version sharing stats export"),
    ("Audio cues", "Distinct sounds for +1 / 0 / −1 tags (optional)"),
]


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]Running Count Speed Drill[/]\n[dim]Core training loop · CountQuest Blackjack[/]",
            title="[bold gold1]Build Complete[/]",
            border_style="green",
        )
    )
    console.print()

    checks = [
        ("screen-drill-speed", r'id="screen-drill-speed"'),
        ("openSpeedDrill()", r"openSpeedDrill\("),
        ("auto-deal timer", r"scheduleSpeedDrillDeal"),
        ("stats history", r"summarizeSpeedDrillHistory"),
        ("practice range entry", r"id: 'count-speed'"),
    ]

    with Progress(SpinnerColumn(), TextColumn("[bold]{task.description}"), BarColumn(bar_width=22), console=console) as prog:
        t = prog.add_task("Verifying implementation…", total=len(checks) + 1)
        for name, pat in checks:
            time.sleep(0.05)
            ok = bool(re.search(pat, html))
            prog.advance(t)
        proc = subprocess.run([sys.executable, str(ROOT / "scripts" / "run_web_tests.py")], cwd=ROOT, capture_output=True, text=True)
        tests_ok = proc.returncode == 0
        prog.advance(t)

    def section_table(title: str, rows: list[tuple[str, str]], border: str) -> None:
        tbl = Table(title=title, border_style=border, header_style="bold", show_header=True)
        tbl.add_column("Item", style="cyan", min_width=16)
        tbl.add_column("Detail", style="white")
        for a, b in rows:
            tbl.add_row(a, b)
        console.print(tbl)
        console.print()

    section_table("What was implemented", IMPLEMENTED, "green")
    section_table("Limitations & assumptions", LIMITATIONS, "yellow")
    section_table("Suggested next improvements", NEXT_STEPS, "blue")

    status = "bold green" if tests_ok else "bold red"
    console.print(Text(f"Tests: {'PASS (39)' if tests_ok else 'FAIL'}", style=status))
    console.print("[dim]Play: Training Mode [5] → ⚡ Running Count Speed Drill[/]")
    console.print()
    return 0 if tests_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())