#!/usr/bin/env python3
"""Rich build summary for Combined Practice Mode."""

from __future__ import annotations

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
    ("Training Mode entry", "🃏 Combined Practice — now LIVE in catalog"),
    ("Real hand flow", "Full deal → play → settle pipeline (not stub hands)"),
    ("Hidden count", "Running count hidden at table — player tracks mentally"),
    ("Strategy decisions", "Hit, Stand, Double, Split during play with mistake hints"),
    ("Post-hand count quiz", "±1 tolerance running count check after every hand"),
    ("Dual feedback", "Strategy score + count accuracy in quiz and hand review"),
    ("Auto min bet", "Fixed minimum wager — focus on count and plays"),
    ("Session stats", "Live session: count % and strategy % in header feedback"),
    ("Lifetime stats", "Sessions saved in save.combinedPractice"),
    ("Exit flow", "End Session returns to Training Mode with summary toast"),
]

NEXT = [
    ("Bet sizing", "Add optional bet-spread decisions to combined hands"),
    ("True count quiz", "Alternate post-hand quiz: RC or TC"),
    ("Hand target", "Play N hands then auto-summarize (like decision drill)"),
    ("Index plays", "Deviations from basic strategy at high counts"),
    ("Insurance drill", "Include insurance decisions in combined feedback"),
    ("Rich CLI mirror", "Textual session dashboard for combined stats"),
]


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]Combined Practice Mode[/]\n[dim]Real blackjack hands · running count + basic strategy[/]",
            title="[bold gold1]Build Complete[/]",
            border_style="green",
        )
    )
    console.print()

    checks = [
        "drill-combined",
        "summarizeCombinedPracticeVisit",
        "finishCombinedPracticeSession",
        "formatCombinedHandReview",
        "launch: 'combined'",
    ]
    with Progress(SpinnerColumn(), TextColumn("[bold]{task.description}"), BarColumn(bar_width=22), console=console) as prog:
        t = prog.add_task("Verifying…", total=len(checks) + 1)
        for c in checks:
            if c not in html:
                console.print(f"[red]Missing:[/] {c}")
            time.sleep(0.04)
            prog.advance(t)
        ok_tests = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
            cwd=ROOT, capture_output=True, text=True,
        ).returncode == 0
        prog.advance(t)

    built = Table(title="What was implemented", border_style="green", header_style="bold")
    built.add_column("Feature", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for a, b in BUILT:
        built.add_row(a, b)
    console.print(built)
    console.print()

    nxt = Table(title="What should come next", border_style="blue", header_style="bold")
    nxt.add_column("Item", style="cyan", min_width=16)
    nxt.add_column("Detail", style="white")
    for a, b in NEXT:
        nxt.add_row(a, b)
    console.print(nxt)
    console.print()

    console.print(Text(f"Tests: {'PASS' if ok_tests else 'FAIL'}", style="bold green" if ok_tests else "bold red"))
    console.print("[dim]Play: Training Mode [5] → 🃏 Combined Practice[/]")
    console.print()
    return 0 if ok_tests else 1


if __name__ == "__main__":
    raise SystemExit(main())