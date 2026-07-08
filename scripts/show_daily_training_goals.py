#!/usr/bin/env python3
"""Display CountQuest Daily Training Goals — goals, progress, and rewards."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, TextColumn
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT / "scripts"))
from load_project_source import load_app_source  # noqa: E402
console = Console()

GOALS = [
    ("Speed Count Sprint", "count-speed", "80%+ on one Running Count round (±1)", "$50", "1 round"),
    ("Combined Reps", "combined", "50 hands in Combined Practice today", "$75", "50 hands"),
    ("True Count Tune-Up", "true-count", "75%+ on a 10-problem True Count round", "$60", "10 problems"),
    ("Index Sharpener", "index-plays", "70%+ on a 5-problem Index Play round", "$55", "5 problems"),
    ("Chart Check", "decisions", "80%+ on a 10-hand Decision Drill", "$50", "10 hands"),
]

BUILT = [
    ("Goal rotation", "5 achievable goals rotate daily via dailyTrainingGoalForDate()"),
    ("Progress store", "save.dailyTraining — progress, streak, completion, rewards"),
    ("Drill hooks", "Speed, TC, Index, Decisions, Combined hand counter"),
    ("Chip rewards", "Base reward + streak bonus (up to +6 days) on completion"),
    ("Daily synergy", "+$25 when both daily challenge and training goal complete"),
    ("Challenge bonus", "Daily challenge now awards +$40 chips on completion"),
    ("Daily screen UI", "Training goal panel with progress bar and streak"),
    ("Training Mode card", "Today's goal visible on Training Mode hub"),
    ("Achievements", "Training Regular + 7-day Training Streak trophies"),
]

REWARDS = [
    ("Base training reward", "$50–$75 depending on goal"),
    ("Streak bonus", "+$10–$15 per consecutive day (capped at 6 extra days)"),
    ("Daily challenge", "+$40 on challenge completion"),
    ("Synergy bonus", "+$25 when both daily tasks done same day"),
]


def demo_progress() -> list[tuple[str, int, str, str]]:
    """Sample progress rows for Rich display."""
    return [
        ("Speed Count Sprint", 100, "1 / 1 round · 100%", "✓ Complete"),
        ("Combined Reps", 62, "31 / 50 hands", "In progress"),
        ("True Count Tune-Up", 0, "Not started", "—"),
    ]


def main() -> int:
    html = load_app_source()
    console.print()
    console.print(
        Panel(
            "[bold]Daily Training Goals[/]\n[dim]Achievable drills · chip rewards · streak progress · daily synergy[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="cyan",
        )
    )
    console.print()

    catalog = Table(title="Daily Training Goal Catalog", border_style="cyan", header_style="bold gold1")
    catalog.add_column("Goal", style="white", min_width=22)
    catalog.add_column("Drill", style="cyan", min_width=14)
    catalog.add_column("Target", style="green", min_width=36)
    catalog.add_column("Base Reward", justify="right", style="yellow")
    catalog.add_column("Scope", style="dim")
    for title, drill, target, reward, scope in GOALS:
        catalog.add_row(title, drill, target, reward, scope)
    console.print(catalog)
    console.print()

    today = Table(title=f"Today's Progress (sample · {datetime.now().strftime('%b %d, %Y')})", border_style="green")
    today.add_column("Goal", style="white", min_width=22)
    today.add_column("Progress", min_width=28)
    today.add_column("Status", style="cyan")
    for title, pct, detail, status in demo_progress():
        bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
        style = "green" if pct >= 100 else "yellow" if pct > 0 else "dim"
        today.add_row(title, Text(f"{bar} {pct}% · {detail}", style=style), status)
    console.print(today)
    console.print()

    progress = Progress(
        TextColumn("[bold cyan]Streak demo[/]"),
        BarColumn(bar_width=30),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TextColumn("· 🔥 3-day streak"),
    )
    progress.add_task("streak", total=7, completed=3)
    console.print(progress)
    console.print()

    rewards = Table(title="Reward Structure", border_style="yellow", header_style="bold")
    rewards.add_column("Reward", style="cyan", min_width=20)
    rewards.add_column("Detail", style="white")
    for a, b in REWARDS:
        rewards.add_row(a, b)
    console.print(rewards)
    console.print()

    built = Table(title="What was implemented", border_style="green", header_style="bold")
    built.add_column("Component", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for a, b in BUILT:
        built.add_row(a, b)
    console.print(built)
    console.print()

    checks = [
        "DAILY_TRAINING_GOAL_TYPES",
        "dailyTrainingGoalForDate",
        "checkDailyTrainingProgress",
        "daily-training-panel",
        "training-daily-goal",
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
    console.print("[dim]In-game: Main Menu [4] Daily Challenge · Training Mode [5] → goal card[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())