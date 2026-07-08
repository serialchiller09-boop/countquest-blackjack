#!/usr/bin/env python3
"""CountQuest Club Hub — combined hub, weekly championship, leader tools summary."""

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
import sys
sys.path.insert(0, str(ROOT / "scripts"))
from load_project_source import load_app_source  # noqa: E402
console = Console()

BUILT = [
    ("Club Hub screen", "Central crew home when in a club — header, weekly bar, announcements, leaderboard, chat, members"),
    ("Member list + stats", "Role, weekly pts, hands, count accuracy; leader ▲▼✕👑 tools"),
    ("Crew chat", "Text messages (200 chars) + reactions 👍🔥💯🃏⭐"),
    ("Announcements", "Leader/Co-Leader posts; pinned-style feed at top of hub"),
    ("Weekly Crew Championship", "ISO week scoring from hands, wins, count quizzes, drill accuracy"),
    ("Internal leaderboard", "🥇🥈🥉 ranking — who is carrying the crew this week"),
    ("Crew milestones", "250 / 500 / 1000 crew pts → chip (+ gem at 1k) rewards to active player"),
    ("Leader tools", "Edit crew, weekly challenge + target, promote/demote/kick/transfer"),
    ("Hierarchy", "Leader · Co-Leader · Officer · Member — permission matrix intact"),
    ("Activity hooks", "handEnd, count quiz, drill summary → recordClubWeeklyActivity"),
]

POINTS = [
    ("Hand played", "+5 pts"),
    ("Winning hand", "+8 bonus"),
    ("Correct count quiz", "+15 pts"),
    ("Training drill", "+0.5× accuracy % (e.g. 80% → 40 pts)"),
]

MILESTONES = [
    ("250 crew pts", "+25 chips"),
    ("500 crew pts", "+50 chips"),
    ("1,000 crew pts", "+100 chips + 1 gem"),
]

NEXT = [
    ("Shared crew bankroll", "Pool chips/gems for crew table sessions — ties into economy"),
    ("Top-3 weekly payouts", "Auto-award rank 1–3 at week rollover"),
    ("Invite codes", "Join private crews without search"),
    ("Goal progress sync", "Auto-track challenge text against live crew totals"),
]


def main() -> int:
    html = load_app_source()
    console.print()
    console.print(
        Panel(
            "[bold]Club Hub + Weekly Championship + Leader Tools[/]\n"
            "[dim]Social home · chat & reactions · weekly leaderboard · hierarchy polish[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="cyan",
        )
    )
    console.print()

    summary = Table(title="Combined Task — What Was Built", border_style="green", header_style="bold gold1")
    summary.add_column("Area", style="cyan", min_width=22)
    summary.add_column("Detail", style="white")
    for area, detail in BUILT:
        summary.add_row(area, detail)
    console.print(summary)
    console.print()

    pts = Table(title="Weekly Point Rules", border_style="yellow", header_style="bold")
    pts.add_column("Activity", style="white")
    pts.add_column("Points", style="green")
    for a, b in POINTS:
        pts.add_row(a, b)
    console.print(pts)
    console.print()

    ms = Table(title="Crew Milestone Rewards", border_style="magenta")
    ms.add_column("Milestone", style="white")
    ms.add_column("Reward", style="yellow")
    for a, b in MILESTONES:
        ms.add_row(a, b)
    console.print(ms)
    console.print()

    progress = Progress(
        TextColumn("[bold cyan]Sample crew week[/]"),
        BarColumn(bar_width=36),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TextColumn("· 421 / 500 pts"),
    )
    progress.add_task("week", total=500, completed=421)
    console.print(progress)
    console.print()

    nxt = Table(title="Next Logical Step", border_style="cyan", header_style="bold gold1")
    nxt.add_column("Feature", style="bold white", min_width=24)
    nxt.add_column("Why", style="dim")
    for feat, why in NEXT:
        nxt.add_row(feat, why)
    console.print(nxt)
    console.print()

    checks = [
        "clubs-hub-view",
        "club-hub-leaderboard",
        "recordClubWeeklyActivity",
        "postClubChatMessage",
        "renderClubHub",
        "SAVE_VERSION = 8",
    ]
    missing = [c for c in checks if c not in html]
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    ok = proc.returncode == 0 and not missing
    if missing:
        console.print(Text(f"Missing: {', '.join(missing)}", style="bold red"))
    console.print(Text(f"Tests: {'PASS' if ok else 'FAIL'}", style="bold green" if ok else "bold red"))
    console.print("[dim]In-game: [7] Counting Crews (in crew) → full Club Hub[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())