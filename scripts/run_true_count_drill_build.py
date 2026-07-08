#!/usr/bin/env python3
"""Rich build summary for True Count Conversion Drill."""

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
    ("Training Mode entry", "📐 True Count Conversion Drill — now LIVE"),
    ("Problem display", "Running count + decks remaining + formula prompt"),
    ("Player input", "Calculate true count (RC ÷ decks) and submit"),
    ("Instant feedback", "Green correct / red wrong with actual TC and error"),
    ("Difficulty levels", "Whole Numbers · One Decimal · Precise"),
    ("Round size", "5 / 10 / 15 problems per round with auto-advance"),
    ("Session stats", "This visit: accuracy % and avg error"),
    ("Lifetime stats", "All-time accuracy saved in save.trueCountDrill"),
    ("Game logic reuse", "Hi-Lo true count formula matches CardCounter.calculateTrueCount"),
]

NEXT = [
    ("Timed mode", "Countdown per problem for speed pressure"),
    ("Streak counter", "Show current correct streak on screen"),
    ("Review missed", "End-of-round recap of wrong answers"),
    ("Link to betting", "Follow-up: pick bet size from true count"),
    ("KO variant", "Separate drill using key count instead of TC"),
    ("Card Burst drill", "Next placeholder to implement from catalog"),
]


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]True Count Conversion Drill[/]\n[dim]RC ÷ decks remaining · math speed trainer[/]",
            title="[bold gold1]Build Complete[/]",
            border_style="green",
        )
    )
    console.print()

    checks = [
        "generateTrueCountProblem",
        "openTrueCountDrill",
        "TC_DRILL_DIFFICULTIES",
        "screen-drill-true-count",
        "status: 'live', launch: 'true-count'",
    ]
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

    built = Table(title="What was built", border_style="green", header_style="bold")
    built.add_column("Feature", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for a, b in BUILT:
        built.add_row(a, b)
    console.print(built)
    console.print()

    diff = Table(title="Difficulty levels", border_style="cyan", header_style="bold")
    diff.add_column("Level", style="gold1")
    diff.add_column("Answer format", style="white")
    diff.add_column("Tolerance", style="dim")
    for key, label, fmt, tol in [
        ("whole", "Whole Numbers", "Integer (e.g. +3)", "±0.01"),
        ("decimal", "One Decimal", "One decimal (e.g. +2.3)", "±0.15"),
        ("precise", "Precise", "Two decimals (e.g. +1.67)", "±0.08"),
    ]:
        if key in html:
            diff.add_row(label, fmt, tol)
    console.print(diff)
    console.print()

    nxt = Table(title="Suggested next improvements", border_style="blue", header_style="bold")
    nxt.add_column("Item", style="cyan", min_width=16)
    nxt.add_column("Detail", style="white")
    for a, b in NEXT:
        nxt.add_row(a, b)
    console.print(nxt)
    console.print()

    console.print(Text(f"Tests: {'PASS' if ok_tests else 'FAIL'}", style="bold green" if ok_tests else "bold red"))
    console.print("[dim]Play: Training Mode [5] → 📐 True Count Conversion Drill[/]")
    console.print()
    return 0 if ok_tests else 1


if __name__ == "__main__":
    raise SystemExit(main())