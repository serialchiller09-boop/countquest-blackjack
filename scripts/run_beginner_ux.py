#!/usr/bin/env python3
"""Rich summary for beginner-friendliness UX pass (5 recommendations)."""

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

ITEMS = [
    (
        "1. Simplify count explanations",
        [
            ("buildCountGuideHtml", r"What is the shoe\?"),
            ("Simpler true count copy", r"Bet a little more when true count is \+1"),
            ("Tutorial count text", r"Cards come from the.*shoe"),
        ],
    ),
    (
        "2. Rename CARDS TAGGED",
        [
            ("Cards Counted label", r"box\('Cards Counted'"),
            ("No old label in HUD", r"box\('Cards Tagged'"),
        ],
    ),
    (
        "3. Plain info (i) popups",
        [
            ("TIP_RUNNING_COUNT", r"const TIP_RUNNING_COUNT"),
            ("TIP_TRUE_COUNT", r"const TIP_TRUE_COUNT"),
            ("Simpler COUNT_DELTA_TIP", r"one card changed the count"),
        ],
    ),
    (
        "4. Explain recommended bet",
        [
            ("recommendedBetWhyText()", r"function recommendedBetWhyText"),
            ("Why text on bet screen", r"recommendedBetWhyText\(this\.betSuggestion\)"),
            ("Info tip on recommended", r"Why this bet amount"),
        ],
    ),
    (
        "5. De-emphasize large bets",
        [
            ("high-roller CSS", r"\.bet-chip\.high-roller"),
            ("High Roller label", r"High Roller"),
            ("Separated chip row", r"highRollerChips"),
        ],
    ),
]


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]Beginner-friendliness pass[/]\n[dim]5 recommendations · CountQuest Blackjack[/]",
            title="[bold gold1]Task Update[/]",
            border_style="green",
        )
    )
    console.print()

    rows: list[tuple[str, str, str]] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold]{task.description}"),
        BarColumn(bar_width=24),
        console=console,
    ) as prog:
        total_steps = sum(len(checks) for _, checks in ITEMS) + 1
        task = prog.add_task("Applying checks…", total=total_steps)

        for item_name, checks in ITEMS:
            for check_name, pattern in checks:
                time.sleep(0.06)
                ok = bool(re.search(pattern, html, re.IGNORECASE | re.DOTALL))
                invert = "No old label" in check_name
                passed = (not ok) if invert else ok
                rows.append((item_name, check_name, "PASS" if passed else "FAIL"))
                prog.advance(task)

        proc = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        rows.append(("Tests", "run_web_tests.py", "PASS" if proc.returncode == 0 else "FAIL"))
        prog.advance(task)

    table = Table(title="Changes Summary", border_style="green", header_style="bold")
    table.add_column("#", style="cyan", width=4)
    table.add_column("Recommendation", min_width=28)
    table.add_column("Change", min_width=26)
    table.add_column("Status", justify="center")

    current_item = ""
    num = 0
    for item, check, status in rows:
        if item != current_item:
            num += 1
            current_item = item
            label = item.split(". ", 1)[-1] if ". " in item else item
        else:
            label = ""
            num_str = ""
        style = "bold green" if status == "PASS" else "bold red"
        table.add_row(
            str(num) if label else "",
            label,
            check,
            Text(status, style=style),
        )

    console.print(table)
    console.print()

    all_pass = all(s == "PASS" for _, _, s in rows)
    if all_pass:
        console.print("[bold green]✓ All 5 beginner UX items verified.[/] Refresh the game in your browser.")
    else:
        console.print("[bold red]✗ Some checks failed.[/]")
    console.print()
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())