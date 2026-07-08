#!/usr/bin/env python3
"""
Rich-powered task reporter for CountQuest development work.

Use when completing to-do items: header → progress → summary table.
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Iterator

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.rule import Rule
from rich.table import Table
from rich.text import Text

console = Console()


@dataclass
class ChangeRow:
    """One line in the end-of-task summary table."""

    area: str
    change: str
    status: str = "done"  # done | skipped | pending | failed

    @property
    def status_style(self) -> str:
        return {
            "done": "bold green",
            "skipped": "dim yellow",
            "pending": "yellow",
            "failed": "bold red",
        }.get(self.status.lower(), "white")


@dataclass
class TaskReporter:
    """Formats professional Rich output for a single development task."""

    task_id: str
    title: str
    project: str = "CountQuest Blackjack"
    changes: list[ChangeRow] = field(default_factory=list)
    _console: Console = field(default_factory=lambda: console)

    def header(self, subtitle: str | None = None) -> None:
        """Print a styled task header."""
        self._console.print()
        title_text = Text()
        title_text.append(f"Task {self.task_id}", style="bold cyan")
        title_text.append(" · ", style="dim")
        title_text.append(self.title, style="bold white")
        body = title_text
        if subtitle:
            body = Text.assemble(title_text, "\n", (subtitle, "dim italic"))
        self._console.print(
            Panel(
                body,
                title=f"[bold gold1]{self.project}[/]",
                border_style="bright_green",
                padding=(1, 2),
            )
        )
        self._console.print()

    @contextmanager
    def progress(self, description: str = "Working…") -> Iterator[tuple[Progress, int]]:
        """Show a spinner + bar while steps run. Yields (progress, task_id)."""
        with Progress(
            SpinnerColumn(style="cyan"),
            TextColumn("[bold]{task.description}"),
            BarColumn(bar_width=32, complete_style="green", finished_style="bright_green"),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=self._console,
            transient=False,
        ) as prog:
            task_id = prog.add_task(description, total=100)
            yield prog, task_id

            if prog.tasks[task_id].completed < prog.tasks[task_id].total:
                prog.update(task_id, completed=100)

    def step(
        self,
        progress: Progress,
        task_key,
        label: str,
        *,
        weight: float = 20,
        pause: float = 0.15,
    ) -> None:
        """Advance progress with a labeled step (optional short pause for visibility)."""
        progress.update(task_key, description=label, advance=weight)
        if pause:
            time.sleep(pause)

    def add_change(self, area: str, change: str, status: str = "done") -> None:
        self.changes.append(ChangeRow(area=area, change=change, status=status))

    def summary(self, notes: str | None = None) -> None:
        """Print a clean summary table of what changed."""
        self._console.print(Rule("[bold]Summary[/]", style="bright_green"))
        self._console.print()

        table = Table(
            title="Changes",
            box=box.ROUNDED,
            show_header=True,
            header_style="bold gold1",
            border_style="bright_green",
            title_style="bold white",
            expand=True,
        )
        table.add_column("Area", style="cyan", min_width=18, no_wrap=True)
        table.add_column("What changed", style="white")
        table.add_column("Status", justify="center", width=10)

        for row in self.changes:
            table.add_row(
                row.area,
                row.change,
                Text(row.status.upper(), style=row.status_style),
            )

        self._console.print(table)
        self._console.print()

        done = sum(1 for c in self.changes if c.status.lower() == "done")
        self._console.print(
            f"[bold green]✓[/] [bold]{done}/{len(self.changes)}[/] changes applied"
            + (f"  [dim]— {notes}[/]" if notes else "")
        )
        self._console.print()


def demo_tutorial_back_button_fix() -> None:
    """Example: Rich output for completed task 1.1 (tutorial back button)."""
    reporter = TaskReporter(
        task_id="1.1",
        title="Tutorial back button fix",
        changes=[],
    )
    reporter.header("Fix Back on page 1 → return to main menu; debounced nav without blocking clicks")

    with reporter.progress("Investigating tutorial navigation…") as (prog, t):
        reporter.step(prog, t, "Reading tutorial handlers in index.html", weight=20)
        reporter.step(prog, t, "Tracing Back button on page 1 (step 0)", weight=20)
        reporter.step(prog, t, "Adding exitTutorial() → goMenu()", weight=25)
        reporter.step(prog, t, "Fixing nav lock (no disabled / pointer-events)", weight=20)
        reporter.step(prog, t, "Running runTests() tutorial assertions", weight=15, pause=0.1)

    reporter.add_change("tutorialBack()", "Page 1 Back calls exitTutorial() instead of no-op", "done")
    reporter.add_change("exitTutorial()", "New helper — clean return to menu, progress preserved", "done")
    reporter.add_change("updateTutorialNavButtons()", "Page 1 label: « ← Main Menu »", "done")
    reporter.add_change("lockTutorialNav()", "280ms debounce only — buttons stay clickable", "done")
    reporter.add_change("#screen-tutorial", "Event delegation for Back / Next / Skip", "done")
    reporter.add_change("Keyboard", "Arrow keys + Escape wired in bindUI()", "done")
    reporter.add_change("runTests()", "Assertions: 5 steps, back-on-page-1 → menu", "done")
    reporter.add_change("index.html", "Tutorial section + CountQuestApp methods", "done")

    reporter.summary("Verified in browser: Back on page 1 returns to main menu")


if __name__ == "__main__":
    demo_tutorial_back_button_fix()