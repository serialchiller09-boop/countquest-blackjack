#!/usr/bin/env python3
"""Tournament brackets + invite deep links — Rich status report."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

ROOT = Path(__file__).resolve().parents[1]
console = Console()

sys.path.insert(0, str(ROOT / "scripts"))
from load_project_source import load_app_source  # noqa: E402
from save_version import read_save_version  # noqa: E402


def main() -> int:
    html = load_app_source()
    console.print()
    console.print(
        Panel(
            "[bold]Plan 21 Next[/]\n[dim]Tournament brackets + friend invite deep links[/]",
            title="[bold gold1]Feature Status[/]",
            border_style="bright_green",
            padding=(1, 2),
        )
    )
    console.print()

    feat = Table(title="Implemented Features", box=box.ROUNDED, border_style="cyan")
    feat.add_column("Feature", style="cyan")
    feat.add_column("Detail", style="white")
    feat.add_column("Built", justify="center")
    rows = [
        ("8-player bracket UI", "Quarterfinals → Semifinals → Final tree", "screen-tournament"),
        ("Pro tier entry", "5000 chips + 1 gem · eligibility checks", "canEnterTournament"),
        ("5-hand duel matches", "Isolated match bankroll vs AI target score", "TOURNAMENT_HANDS_PER_MATCH"),
        ("Prize pool", "🥇 25K+3💎 · 🥈 10K+1💎 · 🥉 5K semis", "TOURNAMENT_PRIZES"),
        ("AI bracket simulation", "Non-player matches resolve automatically", "simulateTournamentRoundAI"),
        ("Club invite deep links", "?join=CODE auto-joins crew on load", "handleInviteDeepLink"),
        ("Club share URL", "Copy full link from club hub", "buildClubInviteUrl"),
        ("Tournament invite links", "?tournament=CODE opens Pro bracket challenge", "handleTournamentInviteDeepLink"),
        ("Tournament share URL", "Copy invite from tournament screen", "buildTournamentInviteUrl"),
    ]
    for name, detail, marker in rows:
        feat.add_row(name, detail, "[green]✓[/]" if marker in html else "[red]✗[/]")
    console.print(feat)
    console.print()

    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    ver = Table(title="Verification", box=box.SIMPLE)
    ver.add_column("Check")
    ver.add_column("Result", justify="center")
    save_ver = read_save_version()
    ver.add_row(f"SAVE_VERSION {save_ver or '?'}", "[green]OK[/]" if save_ver else "[red]FAIL[/]")
    ver.add_row("run_web_tests.py", "[green]PASS[/]" if proc.returncode == 0 else "[red]FAIL[/]")
    console.print(ver)
    console.print()
    console.print("[dim]Lobby → Tournaments → Invite Friend · ?tournament=CODE · Club ?join=CODE[/]")
    console.print()
    return 0 if proc.returncode == 0 and save_ver else 1


if __name__ == "__main__":
    raise SystemExit(main())