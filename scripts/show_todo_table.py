#!/usr/bin/env python3
"""Print CountQuest critical tasks from the project to-do list as a Rich table."""

from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
TODO_PATH = ROOT / "artifacts" / "Blackjack_Game_Todo_List.md"

# Tasks use ## or ### headings, e.g. "## 1.2 Title — ✅ COMPLETE"
TASK_HEADING = re.compile(
    r"^#{2,3}\s+(?P<id>\d+\.\d+)\s+(?P<title>.+)\s+—\s+(?P<status>.+)\s*$",
    re.MULTILINE,
)


def parse_todo_tasks(markdown: str) -> list[dict[str, str]]:
    """Extract numbered tasks (e.g. 1.1, 1.3) and their status from the to-do markdown."""
    tasks: list[dict[str, str]] = []
    for match in TASK_HEADING.finditer(markdown):
        status_raw = match.group("status").strip()
        tasks.append(
            {
                "id": match.group("id"),
                "title": match.group("title").strip(),
                "status": status_raw,
                "complete": "COMPLETE" in status_raw.upper(),
            }
        )
    return tasks


def status_style(status: str) -> str:
    upper = status.upper()
    if "COMPLETE" in upper:
        return "bold green"
    if "IN PROGRESS" in upper or "WIP" in upper:
        return "bold yellow"
    if "BLOCKED" in upper:
        return "bold red"
    return "cyan"


def build_tasks_table(tasks: list[dict[str, str]]) -> Table:
    table = Table(
        title="CountQuest Blackjack — Critical Tasks",
        show_header=True,
        header_style="bold gold1",
        border_style="bright_green",
        title_style="bold bright_white",
    )
    table.add_column("ID", style="cyan", justify="center", width=6)
    table.add_column("Task", style="white", min_width=32)
    table.add_column("Status", justify="center", min_width=14)

    for task in tasks:
        table.add_row(
            task["id"],
            task["title"],
            Text(task["status"], style=status_style(task["status"])),
        )

    if not tasks:
        table.add_row("—", "No tasks found in to-do list", Text("—", style="dim"))

    return table


def print_todo_table(todo_path: Path = TODO_PATH) -> list[dict[str, str]]:
    """Load the to-do list and print a colored Rich table. Returns parsed tasks."""
    console = Console()
    markdown = todo_path.read_text(encoding="utf-8")
    tasks = parse_todo_tasks(markdown)

    console.print()
    console.print(build_tasks_table(tasks))
    console.print()

    done = sum(1 for t in tasks if t["complete"])
    pending = len(tasks) - done
    summary_style = "bold green" if pending == 0 else "bold yellow"
    console.print(
        f"[{summary_style}]{done}/{len(tasks)} complete[/] · "
        f"[dim]Source: {todo_path.relative_to(ROOT)}[/]"
    )
    console.print()

    return tasks


class TestShowTodoTable(unittest.TestCase):
    def test_rich_import(self) -> None:
        from rich.console import Console  # noqa: F401

        self.assertTrue(True)

    def test_textual_import(self) -> None:
        import textual  # noqa: F401

        self.assertTrue(True)

    def test_parse_todo_tasks(self) -> None:
        markdown = TODO_PATH.read_text(encoding="utf-8")
        tasks = parse_todo_tasks(markdown)
        self.assertGreaterEqual(len(tasks), 4)
        ids = {t["id"] for t in tasks}
        self.assertIn("1.1", ids)
        self.assertIn("1.3", ids)
        for task in tasks:
            self.assertTrue(task["complete"], f"{task['id']} should be complete")

    def test_status_style_complete(self) -> None:
        self.assertEqual(status_style("✅ COMPLETE"), "bold green")


if __name__ == "__main__":
    if "--test" in sys.argv:
        raise SystemExit(unittest.main(argv=[sys.argv[0]]))
    print_todo_table()