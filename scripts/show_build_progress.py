#!/usr/bin/env python3
"""Master 6-phase build progress report for CountQuest Blackjack."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
console = Console()

PHASES = [
    ("1", "UI / Polish", "Tutorial nav, beginner labels, full-width layout, count quiz", "COMPLETE"),
    ("2", "Dual Currency + Tables", "Chips/gems HUD, table lobby, entry fees, 1.8× payout", "COMPLETE"),
    ("3", "Daily Rewards", "Login streaks, social connect, chip/gem drops", "COMPLETE"),
    ("4", "Clubs / Counting Crews", "Hierarchy, Club Hub, weekly championship, chat", "COMPLETE"),
    ("5", "Training Drills", "8+ live drills, history, mistakes, session summary", "COMPLETE"),
    ("6", "Polish + VIP Pass", "VIP multipliers, integration, full test suite", "COMPLETE"),
]


def run_tests() -> tuple[bool, int]:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    count = 0
    for line in (proc.stdout + proc.stderr).splitlines():
        if line.strip().startswith("Ran ") and "tests" in line:
            try:
                count = int(line.split()[1])
            except (IndexError, ValueError):
                pass
    return proc.returncode == 0, count


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    save_ver = "14" if "SAVE_VERSION = 14" in html else ("13" if "SAVE_VERSION = 13" in html else ("12" if "SAVE_VERSION = 12" in html else ("11" if "SAVE_VERSION = 11" in html else "?")))
    tests_ok, test_count = run_tests()

    console.print()
    console.print(
        Panel(
            Text.assemble(
                ("CountQuest Blackjack", "bold white"),
                "\n",
                (f"SAVE_VERSION {save_ver} · ", "dim"),
                (f"{test_count} tests ", "cyan"),
                ("PASS" if tests_ok else "FAIL", "bold green" if tests_ok else "bold red"),
            ),
            title="[bold gold1]6-Phase Build Progress[/]",
            border_style="bright_green",
            padding=(1, 2),
        )
    )
    console.print()

    table = Table(
        title="Phase Status",
        box=box.ROUNDED,
        border_style="bright_green",
        header_style="bold gold1",
        expand=True,
    )
    table.add_column("Phase", style="cyan", width=6, justify="center")
    table.add_column("Name", style="white", min_width=20)
    table.add_column("Scope", style="dim")
    table.add_column("Status", justify="center", width=12)

    done = 0
    for num, name, scope, status in PHASES:
        style = "bold green" if status == "COMPLETE" else "yellow"
        table.add_row(num, name, scope, Text(status, style=style))
        if status == "COMPLETE":
            done += 1
    console.print(table)
    console.print()

    console.print(Rule("[bold]Quick verify[/]", style="dim"))
    console.print("[dim]python scripts/show_daily_rewards.py[/]")
    console.print("[dim]python scripts/show_vip_pass.py[/]")
    console.print("[dim]python scripts/run_web_tests.py[/]")
    console.print()
    console.print(
        Text(f"✓ {done}/{len(PHASES)} phases complete", style="bold green")
        if done == len(PHASES) and tests_ok
        else Text(f"{done}/{len(PHASES)} phases · tests {'OK' if tests_ok else 'FAILED'}", style="yellow")
    )
    console.print()
    return 0 if tests_ok and done == len(PHASES) else 1


if __name__ == "__main__":
    raise SystemExit(main())