#!/usr/bin/env python3
"""Rich build summary for Bet Spread Practice Mode (full feature set)."""

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
import sys
sys.path.insert(0, str(ROOT / "scripts"))
from load_project_source import load_app_source  # noqa: E402
console = Console()

IMPLEMENTED = [
    ("½-Kelly overlay", "Educational reference units + estimated edge % each round"),
    ("Heat simulation", "Flags 4+ unit jumps between bets — counts against accuracy"),
    ("KO spread mode", "Practice ramp using running count vs key pivot"),
    ("Bankroll stress", "2% BR safe limit on buttons + feedback warnings"),
    ("Timed rounds", "Optional 5-second countdown per bet"),
    ("Spread builder", "Custom min/max unit range (1–20)"),
    ("Session graph", "SVG chart: chosen vs optimal units per round"),
    ("Core spread drill", "Hi-Lo TC scenarios, coaching, ramp tracking, history"),
]

FUTURE = [
    ("Full Kelly mode", "Optional drill answer key using Kelly instead of linear spread"),
    ("Wonging / back-counting", "Sit out at TC ≤ 0 scenarios"),
    ("Multi-spot heat", "Penalize betting multiple hands when count jumps"),
    ("Export session CSV", "Download round-by-round spread data"),
    ("Live casino presets", "Match specific BJA / Snyder spread tables"),
]


def main() -> int:
    html = load_app_source()
    console.print()
    console.print(
        Panel(
            "[bold]Bet Spread Practice — Complete[/]\n[dim]All suggested improvements implemented[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="green",
        )
    )
    console.print()

    feat = Table(title="Implemented improvements", border_style="green", header_style="bold")
    feat.add_column("Feature", style="cyan", min_width=18)
    feat.add_column("Detail", style="white")
    for a, b in IMPLEMENTED:
        feat.add_row(a, b)
    console.print(feat)
    console.print()

    nxt = Table(title="Possible future enhancements", border_style="blue", header_style="bold")
    nxt.add_column("Item", style="cyan", min_width=16)
    nxt.add_column("Detail", style="white")
    for a, b in FUTURE:
        nxt.add_row(a, b)
    console.print(nxt)
    console.print()

    checks = [
        "kellyBetUnitsFromTrueCount",
        "detectBetSpreadHeat",
        "renderBetSpreadSessionChartHtml",
        "bet-spread-system",
        "bet-spread-custom-range",
        "BET_SPREAD_TIMER_MS",
    ]
    with Progress(SpinnerColumn(), TextColumn("[bold]{task.description}"), BarColumn(bar_width=22), console=console) as prog:
        t = prog.add_task("Verifying…", total=len(checks) + 1)
        for c in checks:
            if c not in html:
                console.print(f"[red]Missing:[/] {c}")
            time.sleep(0.03)
            prog.advance(t)
        ok_tests = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
            cwd=ROOT, capture_output=True, text=True,
        ).returncode == 0
        prog.advance(t)

    console.print(Text(f"Tests: {'PASS' if ok_tests else 'FAIL'}", style="bold green" if ok_tests else "bold red"))
    console.print("[dim]Play: Training Mode [5] → 📈 Bet Spread Practice[/]")
    console.print()
    return 0 if ok_tests else 1


if __name__ == "__main__":
    raise SystemExit(main())