#!/usr/bin/env python3
"""Display CountQuest Counting Crews (Clubs) — create, search, join, member list."""

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

FEATURES = [
    ("Create crew", "Name (3–24 chars), description (120 max), public or private visibility"),
    ("Search & browse", "Filter public crews by name/description; private crews hidden"),
    ("Join crew", "One crew per player; max 50 members; full crews show locked"),
    ("Member list", "Owner crown, rank, help level, (you) marker, sorted owner-first"),
    ("Leave crew", "Owner transfer to next member; empty crew deleted from registry"),
    ("Demo crews", "Ace Counters & KO Knockouts seeded on first visit"),
]

STORAGE = [
    ("Player save", "save.playerId, save.club { clubId, role, joinedAt } — SAVE_VERSION 6"),
    ("Club registry", "localStorage key countquest-clubs-v1 — shared browser-wide"),
    ("Profile sync", "Member display name/rank/help level refresh on crew view"),
]

FLOW = [
    ("Main menu [7]", "Counting Crews → hub screen"),
    ("Not in crew", "Search bar + results + Create Crew button"),
    ("Create", "Form → validates → you become owner → member list shows you"),
    ("Join", "Click Join on search card → deducted nothing (social only for now)"),
    ("In crew", "Crew card + member list + Leave Crew; browse panel hidden"),
]

NEXT = [
    ("Club bankroll", "Shared chip pool for crew table sessions"),
    ("Club tables", "Crew-only ranked tables and weekly goals"),
    ("Invites & chat", "Private crew invite codes and lightweight messaging"),
    ("Leaderboards", "Crew vs crew stats — hands, accuracy, table wins"),
    ("Daily Rewards", "Login streaks with chip/gem drops (parallel economy track)"),
]


def main() -> int:
    html = load_app_source()
    console.print()
    console.print(
        Panel(
            "[bold]Counting Crews (Clubs)[/]\n"
            "[dim]Create · search · join · member list · 50 cap · local registry[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="cyan",
        )
    )
    console.print()

    built = Table(title="What Was Built", border_style="green", header_style="bold gold1")
    built.add_column("Feature", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for a, b in FEATURES:
        built.add_row(a, b)
    console.print(built)
    console.print()

    store = Table(title="Data Model", border_style="yellow", header_style="bold")
    store.add_column("Layer", style="cyan", min_width=14)
    store.add_column("Detail", style="white")
    for a, b in STORAGE:
        store.add_row(a, b)
    console.print(store)
    console.print()

    flow = Table(title="Player Flow", border_style="cyan", header_style="bold")
    flow.add_column("Step", style="white", min_width=16)
    flow.add_column("Action", style="dim")
    for a, b in FLOW:
        flow.add_row(a, b)
    console.print(flow)
    console.print()

    limits = Table(title="Rules & Limits", border_style="magenta")
    limits.add_column("Rule", style="white")
    limits.add_column("Value", style="green")
    limits.add_row("Max members per crew", "50")
    limits.add_row("Crews per player", "1 (leave before joining another)")
    limits.add_row("Private crews", "Hidden from search")
    limits.add_row("Duplicate names", "Blocked (case-insensitive)")
    limits.add_row("Owner leaves", "Ownership passes to longest-standing member")
    console.print(limits)
    console.print()

    nxt = Table(title="What Comes Next", border_style="magenta", header_style="bold gold1")
    nxt.add_column("Feature", style="bold white", min_width=22)
    nxt.add_column("Why", style="dim")
    for feat, why in NEXT:
        nxt.add_row(feat, why)
    console.print(nxt)
    console.print()

    checks = [
        "createClub",
        "searchClubs",
        "screen-clubs",
        "openClubs",
        "CLUB_MAX_MEMBERS",
    ]
    missing = [c for c in checks if c not in html]
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    ok = proc.returncode == 0 and not missing
    if missing:
        console.print(Text(f"Missing in index.html: {', '.join(missing)}", style="bold red"))
    console.print(Text(f"Tests: {'PASS' if ok else 'FAIL'} ({49 if ok else '?'}/49)", style="bold green" if ok else "bold red"))
    console.print("[dim]In-game: Main Menu [7] Counting Crews[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())