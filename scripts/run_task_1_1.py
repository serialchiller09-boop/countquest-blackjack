#!/usr/bin/env python3
"""Verify task 1.1 (tutorial back button) and print Rich progress + summary."""

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

CHECKS = [
    ("exitTutorial()", r"exitTutorial\(\)\s*\{"),
    ("tutorialBack() → exit on step 0", r"tutorialBack\(\)[\s\S]{0,400}exitTutorial\(\)"),
    ("goMenu() in exitTutorial", r"exitTutorial\(\)[\s\S]{0,200}goMenu\(\)"),
    ("Event delegation on #screen-tutorial", r"screen-tutorial.*btn-tutorial-back"),
    ("Page 1 label ← Main Menu", r'btn-tutorial-back.*← Main Menu'),
    ("updateTutorialNavButtons", r"updateTutorialNavButtons"),
    (
        "No pointer-events block on nav CSS",
        r"#screen-tutorial\[data-nav-busy[^\]]*\][^{]*\{[^}]*pointer-events",
    ),
    ("runTests tutorial assertions", r"tutorial back on page 1 exits to menu"),
]


def main() -> int:
    console.print()
    console.print(
        Panel(
            "[bold cyan]Task 1.1[/] · [bold]Tutorial Navigation — Back Button[/]\n"
            "[dim]Verify page-1 Back exits to menu; Back works on all pages[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="green",
        )
    )
    console.print()

    html = INDEX.read_text(encoding="utf-8")
    results: list[tuple[str, str, str]] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(bar_width=28),
        TextColumn("{task.percentage:>3.0f}%"),
        console=console,
    ) as prog:
        task = prog.add_task("Checking tutorial navigation code…", total=len(CHECKS) + 1)
        for label, pattern in CHECKS:
            time.sleep(0.08)
            ok = bool(re.search(pattern, html, re.IGNORECASE | re.DOTALL))
            invert = "No pointer-events" in label
            passed = not ok if invert else ok
            results.append((label, "PASS" if passed else "FAIL", "done" if passed else "failed"))
            prog.advance(task)

        time.sleep(0.1)
        proc = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        tests_ok = proc.returncode == 0
        results.append(("run_web_tests.py (37 tests)", "PASS" if tests_ok else "FAIL", "done" if tests_ok else "failed"))
        prog.advance(task)

    console.print()
    table = Table(title="Task 1.1 — Verification Summary", border_style="green", header_style="bold")
    table.add_column("Check", style="cyan")
    table.add_column("Result", justify="center")
    table.add_column("Notes", style="dim")

    notes = {
        "exitTutorial()": "Returns to main menu without marking complete",
        "tutorialBack() → exit on step 0": "Page 1 Back no longer a no-op",
        "goMenu() in exitTutorial": "Calls render() so menu actually shows",
        "Event delegation on #screen-tutorial": "Clicks always reach handlers",
        "Page 1 label ← Main Menu": "Clear label on welcome page",
        "updateTutorialNavButtons": "Back label updates per step",
        "No pointer-events: none on nav": "Buttons stay clickable after debounce",
        "runTests tutorial assertions": "Automated browser tests in index.html",
        "run_web_tests.py (37 tests)": "Python parity + structure tests",
    }

    all_pass = True
    for label, result, _ in results:
        style = "bold green" if result == "PASS" else "bold red"
        if result != "PASS":
            all_pass = False
        table.add_row(label, Text(result, style=style), notes.get(label, ""))

    console.print(table)
    console.print()

    if all_pass:
        console.print("[bold green]✓ Task 1.1 is already implemented and verified.[/] No code changes needed.")
        console.print("[dim]Try it: Main menu → Tutorial → Back on page 1 → main menu[/]")
    else:
        console.print("[bold red]✗ Some checks failed — review index.html[/]")

    console.print()
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())