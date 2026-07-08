#!/usr/bin/env python3
"""Display CountQuest club hierarchy — roles, permissions, and leader tools."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
console = Console()

ROLES = [
    ("Leader", "👑", "Full control — top of hierarchy"),
    ("Co-Leader", "⭐", "Manage officers & members, edit info & goals"),
    ("Officer", "🛡", "Kick members only"),
    ("Member", "—", "View crew info and member list"),
]

PERMISSIONS = [
    ("Edit crew info", "✓", "✓", "—", "—"),
    ("Set crew goals", "✓", "✓", "—", "—"),
    ("Promote / demote", "✓", "✓*", "—", "—"),
    ("Kick members", "✓", "✓", "✓†", "—"),
    ("Transfer leadership", "✓", "—", "—", "—"),
]

PROMOTE_RULES = [
    ("Leader", "Member → Officer → Co-Leader (max 3 Co-Leaders)"),
    ("Co-Leader", "Member → Officer only"),
    ("Officer / Member", "No promotion rights"),
]

BUILT = [
    ("4-tier hierarchy", "leader · co-leader · officer · member (owner migrated)"),
    ("Permission matrix", "hasClubPermission + canActOnMember rank checks"),
    ("Promote / demote", "▲ ▼ buttons on member rows when allowed"),
    ("Kick", "✕ with confirm — rank-gated (Officer: Members only)"),
    ("Transfer leadership", "👑 Leader → target; former Leader becomes Co-Leader"),
    ("Edit crew", "Name, description, visibility, crew goal (80 chars)"),
    ("Crew goals", "Displayed on membership panel; Leader/Co-Leader can set"),
    ("Auto succession", "Leader leave → next Co-Leader, Officer, or Member"),
    ("SAVE_VERSION 7", "save.club.role normalized; clubs get leaderId + goal"),
]

NEXT = [
    ("Goal progress tracking", "Auto-track crew goal completion from play"),
    ("Club bankroll", "Shared chip pool for crew table sessions"),
    ("Invite codes", "Join private crews via shareable code"),
    ("Activity feed", "Promotions, kicks, goal updates logged"),
    ("Daily Rewards", "Login streaks with chip/gem drops"),
]


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]Club Hierarchy System[/]\n"
            "[dim]Leader · Co-Leader · Officer · Member — promote, kick, edit, goals[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="cyan",
        )
    )
    console.print()

    roles = Table(title="Roles", border_style="cyan", header_style="bold gold1")
    roles.add_column("Role", style="white", min_width=12)
    roles.add_column("", justify="center", width=3)
    roles.add_column("Summary", style="dim")
    for name, icon, summary in ROLES:
        roles.add_row(name, icon, summary)
    console.print(roles)
    console.print()

    perms = Table(title="Permissions Matrix", border_style="green", header_style="bold")
    perms.add_column("Action", style="white", min_width=22)
    perms.add_column("Leader", justify="center", style="bold yellow")
    perms.add_column("Co-Leader", justify="center", style="bold cyan")
    perms.add_column("Officer", justify="center")
    perms.add_column("Member", justify="center")
    for action, leader, co, off, mem in PERMISSIONS:
        perms.add_row(action, leader, co, off, mem)
    console.print(perms)
    console.print("[dim]* Co-Leader: cannot promote to Co-Leader or manage equal/higher ranks[/]")
    console.print("[dim]† Officer: kick Members only[/]")
    console.print()

    promo = Table(title="Promotion Ladder", border_style="yellow", header_style="bold")
    promo.add_column("Actor", style="cyan", min_width=12)
    promo.add_column("Can promote", style="white")
    for actor, rule in PROMOTE_RULES:
        promo.add_row(actor, rule)
    console.print(promo)
    console.print()

    built = Table(title="What Was Built", border_style="green", header_style="bold gold1")
    built.add_column("Component", style="cyan", min_width=20)
    built.add_column("Detail", style="white")
    for a, b in BUILT:
        built.add_row(a, b)
    console.print(built)
    console.print()

    nxt = Table(title="What Comes Next", border_style="magenta", header_style="bold gold1")
    nxt.add_column("Feature", style="bold white", min_width=24)
    nxt.add_column("Why", style="dim")
    for feat, why in NEXT:
        nxt.add_row(feat, why)
    console.print(nxt)
    console.print()

    checks = [
        "CLUB_ROLE_LABELS",
        "promoteClubMember",
        "demoteClubMember",
        "kickClubMember",
        "transferClubLeadership",
        "updateClubInfo",
        "clubs-edit-view",
        "data-club-promote",
        "SAVE_VERSION = 7",
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
    console.print("[dim]In-game: [7] Counting Crews → member ▲▼✕👑 · Edit Crew Info & Goal[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())