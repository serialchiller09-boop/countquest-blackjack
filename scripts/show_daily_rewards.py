#!/usr/bin/env python3
"""Display CountQuest Daily Login Rewards — streaks, ladder, social connect."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT / "scripts"))
from load_project_source import load_app_source  # noqa: E402
console = Console()

LADDER = [
    ("Day 1", "100 chips"),
    ("Day 2", "125 chips"),
    ("Day 3", "150 chips"),
    ("Day 4", "175 chips + 1 gem"),
    ("Day 5", "200 chips"),
    ("Day 6", "250 chips + 1 gem"),
    ("Day 7+", "300 chips + 2 gems (+25 chips/day cap)"),
]

BUILT = [
    ("Login store", "save.dailyRewards — streak, claim state, social flags"),
    ("7-day ladder", "DAILY_LOGIN_REWARD_TABLE with escalating chips/gems"),
    ("Auto popup", "modal-daily-reward on menu when unclaimed"),
    ("Daily Rewards [8]", "Full screen — ladder, social, VIP section"),
    ("Daily Challenge tie-in", "Login panel on Daily Challenge screen [4]"),
    ("Facebook connect", f"+500 chips + 5 gems (simulated, one-time)"),
    ("Google connect", f"+500 chips + 5 gems (simulated, one-time)"),
    ("Achievements", "Dedicated Counter (7-day) + Connected trophies"),
]


def main() -> int:
    html = load_app_source()
    console.print()
    console.print(
        Panel(
            "[bold]Daily Login Rewards[/]\n[dim]Streaks · chip/gem drops · social bonuses · VIP 2×[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="yellow",
        )
    )
    console.print()

    ladder = Table(title="7-Day Login Ladder", border_style="yellow", header_style="bold gold1")
    ladder.add_column("Day", style="cyan", min_width=10)
    ladder.add_column("Reward", style="green")
    for day, reward in LADDER:
        ladder.add_row(day, reward)
    console.print(ladder)
    console.print()

    built = Table(title="Phase 3 — Implemented", border_style="green", header_style="bold")
    built.add_column("Component", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for area, detail in BUILT:
        built.add_row(area, detail)
    console.print(built)
    console.print()

    checks = [
        "DAILY_LOGIN_REWARD_TABLE",
        "claimDailyLoginReward",
        "connectSocialAccount",
        "screen-daily-rewards",
        "modal-daily-reward",
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
    console.print("[dim]In-game: Main Menu [8] Daily Rewards · auto popup on login[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())