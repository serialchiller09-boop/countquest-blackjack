#!/usr/bin/env python3
"""Display CountQuest Drill Session Summary implementation — improved + next steps."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, TextColumn
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
console = Console()

IMPROVED = [
    ("Unified summary screen", "screen-drill-session-summary after every drill session"),
    ("Normalized stats", "Accuracy %, correct/incorrect, avg error, elapsed time"),
    ("Personal best", "save.drillSessionBests — compare vs previous best session"),
    ("Visual layout", "Accuracy hero + progress bar + 4-stat grid + comparison card"),
    ("Session timing", "markDrillSessionStart() on each drill round / visit"),
    ("All 8 drills hooked", "Speed, TC, Index, Spread, Combined, Shoe, Decisions, Betting"),
    ("Bet spread chart", "Session bet-vs-optimal chart on summary screen"),
    ("Speed drill exit", "End Session button shows visit summary"),
]

NEXT = [
    ("Sparkline trends", "Mini accuracy graph vs last 10 sessions per drill"),
    ("Session history list", "Expandable log of past summaries from trainingHistory"),
    ("Share / export", "Copy summary as text or screenshot for study notes"),
    ("Goal overlay", "Show daily training goal progress on summary screen"),
    ("Mistake highlights", "Top 3 mistakes from session linked to Review Mistakes"),
    ("Pace analytics", "Cards/min or problems/min on counting drills"),
]


def demo_summary_rows() -> list[tuple]:
    return [
        ("True Count Conversion", 82, 9, 1, 0.18, "3m 12s", "+4% vs best", True),
        ("Combined Practice", 75, 38, 12, None, "18m 40s", "−2% vs best", False),
        ("Bet Spread Practice", 90, 9, 1, 0.4, "4m 05s", "★ New best", True),
    ]


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]Drill Session Summary Screen[/]\n[dim]Rich end-of-session stats · personal best comparison · all drills[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="cyan",
        )
    )
    console.print()

    sample = Table(title="Sample Session Summaries", border_style="cyan", header_style="bold gold1")
    sample.add_column("Drill", style="white", min_width=22)
    sample.add_column("Accuracy", justify="right")
    sample.add_column("Correct", justify="right", style="green")
    sample.add_column("Wrong", justify="right", style="red")
    sample.add_column("Avg Err", justify="right", style="yellow")
    sample.add_column("Time", style="cyan")
    sample.add_column("vs Best", style="dim")
    sample.add_column("", justify="center")

    for name, acc, ok, bad, err, time_, vs, new_best in demo_summary_rows():
        acc_style = "green" if acc >= 80 else "yellow" if acc >= 60 else "red"
        err_s = f"{err:.2f}" if err is not None else "—"
        sample.add_row(
            name,
            Text(f"{acc}%", style=acc_style),
            str(ok),
            str(bad),
            err_s,
            time_,
            vs,
            "★" if new_best else "",
        )
    console.print(sample)
    console.print()

    prog = Progress(
        TextColumn("[bold]Accuracy[/]"),
        BarColumn(bar_width=32),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
    )
    prog.add_task("acc", total=100, completed=82)
    console.print(prog)
    console.print()

    improved = Table(title="What was improved", border_style="green", header_style="bold")
    improved.add_column("Component", style="cyan", min_width=20)
    improved.add_column("Detail", style="white")
    for a, b in IMPROVED:
        improved.add_row(a, b)
    console.print(improved)
    console.print()

    nxt = Table(title="Good next additions", border_style="blue", header_style="bold")
    nxt.add_column("Item", style="cyan", min_width=18)
    nxt.add_column("Detail", style="white")
    for a, b in NEXT:
        nxt.add_row(a, b)
    console.print(nxt)
    console.print()

    checks = [
        "buildDrillSessionSummary",
        "screen-drill-session-summary",
        "finishDrillWithSummary",
        "renderDrillSessionSummaryHtml",
    ]
    missing = [c for c in checks if c not in html]
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    ok = proc.returncode == 0 and not missing
    if missing:
        console.print(Text(f"Missing in index.html: {', '.join(missing)}", style="bold red"))
    console.print(Text(f"Tests: {'PASS' if ok else 'FAIL'}", style="bold green" if ok else "bold red"))
    console.print("[dim]In-game: complete any drill → Session Summary screen[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())