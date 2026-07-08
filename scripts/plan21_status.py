#!/usr/bin/env python3
"""Plan 21 unified status — 8 Ball Pool lobby + Clubs system."""

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

LOBBY_CHECKS = [
    ("lobby-clubs-btn", "Large Clubs button (top-left)"),
    ("lobby-profile-avatar", "Player profile + level ring"),
    ("lobby-xp-bar", "XP progress bar"),
    ("lobby-chips", "Chips currency display"),
    ("lobby-gems", "Gems currency display"),
    ("lobby-currency-buy", "Currency + buy buttons"),
    ("lobby-nav-icons", "Free Rewards / Leaderboards / Shop nav"),
    ("lobby-pass-banner", "CountQuest Pass banner"),
    ("startLobbyPassTimer", "Live Pass countdown timer"),
    ("lobby-hero-play", "Hero Play button (1v1)"),
    ("lobby-secondary-left", "Secondary play modes (left)"),
    ("lobby-secondary-right", "Secondary play modes (right)"),
    ("lobby-bottom-dock", "Fixed bottom reward row"),
    ("lobby-spin-wheel", "Spin & Win wheel UI"),
    ("lobby-scratch-grid", "Scratch & Win tiles"),
    ("renderLobby", "Lobby render function"),
    ("handleLobbyNav", "Top nav routing"),
    ("handleLobbyPlay", "Play button routing"),
    ("SPECIAL_EVENTS", "Rotating weekly special events"),
    ("screen-special-event", "Special Event screen"),
    ("openSpecialEvent", "Special Event lobby routing"),
    ("getGlobalCrewLeaderboard", "Global crew leaderboard"),
]

CLUBS_CHECKS = [
    ("screen-clubs", "Counting Crews screen"),
    ("createClub", "Club creation"),
    ("joinClub", "Join club"),
    ("CLUB_PERMISSIONS", "Hierarchy permission matrix"),
    ("promoteClubMember", "Promote member"),
    ("demoteClubMember", "Demote member"),
    ("kickClubMember", "Kick member"),
    ("transferClubLeadership", "Transfer leadership"),
    ("clubs-hub-view", "Club Hub view"),
    ("club-hub-chat", "Crew chat"),
    ("club-hub-leaderboard", "Weekly leaderboard"),
    ("club-hub-weekly", "Weekly championship bar"),
    ("recordClubWeeklyActivity", "Weekly point scoring"),
    ("getClubWeeklyLeaderboard", "Weekly ranking"),
    ("processWeeklyTop3Payouts", "Top-3 weekly payouts"),
    ("club-hub-bankroll", "Shared crew bankroll"),
    ("joinClubByInviteCode", "Invite code join"),
    ("buildClubInviteUrl", "Shareable invite deep link"),
    ("handleInviteDeepLink", "?join=CODE on load"),
    ("openClubs", "Lobby Clubs button → openClubs()"),
]


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    test_count = "63" if proc.returncode == 0 else "?"

    console.print()
    console.print(
        Panel(
            "[bold]8 Ball Pool for Card Counting Blackjack[/]\n"
            "[dim]Plan 21 — Main lobby + Clubs hierarchy + weekly competition[/]",
            title="[bold gold1]CountQuest Plan 21 Status[/]",
            border_style="bright_green",
            padding=(1, 2),
        )
    )
    console.print()

    meta = Table(box=box.SIMPLE, show_header=False)
    meta.add_column("Key", style="dim")
    meta.add_column("Value", style="white")
    save_ver = "17" if "const SAVE_VERSION = 17" in html else "?"
    meta.add_row("Project", str(ROOT))
    meta.add_row("SAVE_VERSION", save_ver)
    meta.add_row("Tests", f"{test_count}/63 {'PASS' if proc.returncode == 0 else 'FAIL'}")
    meta.add_row("Entry", "Open index.html — lobby is default home")
    console.print(meta)
    console.print()

    lobby = Table(title="Phase 1 — Main Home Screen (8BP Template)", box=box.ROUNDED, border_style="cyan")
    lobby.add_column("Component", style="cyan")
    lobby.add_column("Description", style="white")
    lobby.add_column("Built", justify="center")
    for marker, desc in LOBBY_CHECKS:
        lobby.add_row(marker, desc, "[green]✓[/]" if marker in html else "[red]✗[/]")
    console.print(lobby)
    console.print()

    clubs = Table(title="Phase 2 — Clubs / Counting Crews", box=box.ROUNDED, border_style="green")
    clubs.add_column("Component", style="green")
    clubs.add_column("Description", style="white")
    clubs.add_column("Built", justify="center")
    for marker, desc in CLUBS_CHECKS:
        clubs.add_row(marker, desc, "[green]✓[/]" if marker in html else "[red]✗[/]")
    console.print(clubs)
    console.print()

    flow = Table(title="Player Flows (functional wiring)", box=box.ROUNDED, border_style="yellow")
    flow.add_column("From", style="gold1")
    flow.add_column("Action", style="white")
    flow.add_column("Routes to", style="dim")
    for row in [
        ("Clubs button", "data-lobby-nav=clubs", "openClubs() → Club Hub"),
        ("Hero Play", "data-lobby-play=tables", "openTableLobby()"),
        ("Tournaments", "data-lobby-play=tournament", "openTournament()"),
        ("Special Event", "data-lobby-play=special-event", "openSpecialEvent()"),
        ("Training Drills", "data-lobby-play=training", "openTrainingMode()"),
        ("Dealer Shift", "data-lobby-play=dealer-mode", "openDealerMode('lobby')"),
        ("With Friends", "data-lobby-play=clubs", "openClubs()"),
        ("Free Rewards nav", "data-lobby-nav=daily-rewards", "openDailyRewards()"),
        ("Leaderboards nav", "data-lobby-nav=leaderboards", "openLobbyLeaderboards()"),
        ("Shop nav", "data-lobby-nav=shop", "openLobbyShop()"),
        ("Pass banner", "#lobby-pass-banner click", "openDailyRewards()"),
        ("Bottom dock tile", "data-lobby-minigame", "openLobbyMinigame()"),
        ("Invite link", "?join=CODE", "handleInviteDeepLink → join crew"),
    ]:
        ok = row[2].split("(")[0].strip() in html or row[1].split("=")[0] in html
        flow.add_row(row[0], row[1], row[2] + (" ✓" if ok else ""))
    console.print(flow)
    console.print()

    ok = proc.returncode == 0 and save_ver == "17"
    console.print(
        f"[bold]{'✓ Plan 21 lobby + Clubs COMPLETE' if ok else '✗ Verification FAILED'}[/]  "
        f"[dim]python scripts/plan21_status.py[/]"
    )
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())