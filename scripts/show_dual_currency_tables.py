#!/usr/bin/env python3
"""Display CountQuest dual currency + ranked table tiers — economy foundation."""

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

CURRENCIES = [
    ("Chips", "🪙", "Soft currency — earned from play, drills, daily goals, and table wins"),
    ("Gems", "💎", "Hard currency — premium; Pro table requires 1 gem entry"),
]

TABLE_TIERS = [
    ("Beginner", "🌱", 50, 0, 200, "Help L0", "Novice", "10–100", "classic"),
    ("Casual", "🎲", 200, 0, 800, "Help L1+", "Novice", "25–500", "classic"),
    ("High Roller", "🎰", 1000, 0, 5000, "Help L2+", "Apprentice+", "100–2,500", "neon"),
    ("Pro", "👑", 5000, 1, 20000, "Help L3+", "Journeyman+", "500–10,000", "monte"),
]

FEE_STEPS = [
    ("1. Join table", "Deduct entry fee from your chips (and gems at Pro)"),
    ("2. House matches", "Pot = 2 × entry (your ante + house ante)"),
    ("3. Play session", "Blackjack hands within tier min/max bet limits"),
    ("4. End session", "netPL > 0 → winner gets 1.8× entry chips; else entry forfeited"),
    ("5. Rake", "~10% of pot retained by house (pot − 1.8× entry)"),
]

BUILT = [
    ("Dual wallet", "save.chips + save.gems synced with legacy bankroll (SAVE_VERSION 5)"),
    ("Currency HUD", "Header + main menu bar show chips and gems"),
    ("Table lobby", "Main menu [6] Play Tables → tier cards with lock reasons"),
    ("Entry payment", "payTableEntry() validates rank/help/bankroll and deducts fees"),
    ("Session payout", "settleTableSessionIfNeeded() on end — 1.8× win multiplier"),
    ("Table limits", "Per-tier minBet, maxBet, unitSize, and theme on join"),
    ("Continue session", "Resumes active table session with tier metadata"),
]

NEXT_OPTIONS = [
    ("Daily Rewards (recommended)", "Login streaks, free chip/gem drops, synergy with daily training"),
    ("Clubs (done — foundation)", "Crew bankroll, crew tables, invites, leaderboards"),
]


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]Dual Currency + Table Costs[/]\n"
            "[dim]Chips & gems · ranked lobby · entry fees · 1.8× pot payout · ~10% rake[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="cyan",
        )
    )
    console.print()

    curr = Table(title="Currencies Created", border_style="green", header_style="bold gold1")
    curr.add_column("Currency", style="white", min_width=10)
    curr.add_column("", justify="center", width=3)
    curr.add_column("Type", style="cyan", min_width=8)
    curr.add_column("Description", style="dim")
    for name, icon, desc in CURRENCIES:
        kind = "Soft" if name == "Chips" else "Hard"
        curr.add_row(name, icon, kind, desc)
    console.print(curr)
    console.print()

    tiers = Table(title="Table Tiers (Lobby)", border_style="cyan", header_style="bold gold1")
    tiers.add_column("Tier", style="white", min_width=14)
    tiers.add_column("", justify="center", width=3)
    tiers.add_column("Entry Chips", justify="right", style="green")
    tiers.add_column("Gems", justify="right", style="magenta")
    tiers.add_column("Min Bankroll", justify="right", style="yellow")
    tiers.add_column("Requirements", style="cyan", min_width=14)
    tiers.add_column("Bet Range", style="dim")
    tiers.add_column("Theme", style="dim")
    for name, icon, chips, gems, min_br, req, rank, bets, theme in TABLE_TIERS:
        tiers.add_row(
            name, icon,
            f"{chips:,}", str(gems) if gems else "—",
            f"{min_br:,}", f"{req} · {rank}",
            bets, theme,
        )
    console.print(tiers)
    console.print()

    fees = Table(title="How Fees & Payouts Work", border_style="yellow", header_style="bold")
    fees.add_column("Step", style="cyan", min_width=16)
    fees.add_column("Detail", style="white")
    for step, detail in FEE_STEPS:
        fees.add_row(step, detail)
    console.print(fees)
    console.print()

    examples = Table(title="Payout Examples (winner)", border_style="green", header_style="bold")
    examples.add_column("Tier", style="white")
    examples.add_column("Entry", justify="right", style="green")
    examples.add_column("Pot (2×)", justify="right")
    examples.add_column("Win (1.8×)", justify="right", style="bold green")
    examples.add_column("Rake (~10%)", justify="right", style="dim")
    for name, _, entry, *_ in TABLE_TIERS:
        pot = entry * 2
        win = round(entry * 1.8)
        rake = pot - win
        examples.add_row(name, f"{entry:,}", f"{pot:,}", f"{win:,}", f"{rake:,}")
    console.print(examples)
    console.print()

    built = Table(title="What Was Implemented", border_style="green", header_style="bold")
    built.add_column("Component", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for a, b in BUILT:
        built.add_row(a, b)
    console.print(built)
    console.print()

    nxt = Table(title="What to Build Next", border_style="magenta", header_style="bold gold1")
    nxt.add_column("Feature", style="bold white", min_width=28)
    nxt.add_column("Why", style="dim")
    for feat, why in NEXT_OPTIONS:
        nxt.add_row(feat, why)
    console.print(nxt)
    console.print()

    checks = [
        "TABLE_TIERS",
        "payTableEntry",
        "screen-table-lobby",
        "menu-currency-bar",
        "openTableLobby",
        "SAVE_VERSION = 5",
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
    console.print("[dim]In-game: Main Menu [6] Play Tables · header shows 🪙 chips + 💎 gems[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())