#!/usr/bin/env python3
"""Display CountQuest VIP Pass — premium perks and purchase flow."""

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

PERKS = [
    ("2× daily login chips", "VIP_CHIP_MULTIPLIER applied to login rewards"),
    ("2× synergy bonus", "Daily challenge + training synergy doubled"),
    ("+10% table wins", "Extra chips on ranked table session payouts"),
    ("VIP badge", "Menu Daily Rewards card shows VIP status"),
    ("3-day free trial", "One-time trial before gem purchase"),
    ("30-day purchase", "25 gems extends or activates VIP Pass"),
]

BUILT = [
    ("VIP store", "save.vipPass — active, expiresAt, trialUsed, source"),
    ("Purchase flow", "purchaseVipPass() deducts gems, activates/extends"),
    ("Trial flow", "claimVipTrial() — 3 days, once per save"),
    ("Table integration", "vipTableWinBonus() in settleTableSession"),
    ("Login integration", "applyVipChipBonus() on daily login rewards"),
    ("Synergy integration", "getEffectiveSynergyBonus() for daily double"),
    ("UI", "daily-rewards-vip panel with trial + purchase buttons"),
    ("Achievement", "VIP Counter trophy on activation"),
]


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]VIP Pass[/]\n[dim]Premium retention tier — multipliers, badge, trial[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="purple",
        )
    )
    console.print()

    perks = Table(title="VIP Perks", border_style="purple", header_style="bold")
    perks.add_column("Perk", style="cyan", min_width=22)
    perks.add_column("How it works", style="white")
    for perk, how in PERKS:
        perks.add_row(perk, how)
    console.print(perks)
    console.print()

    built = Table(title="Phase 6 — VIP Pass", border_style="green", header_style="bold")
    built.add_column("Component", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for area, detail in BUILT:
        built.add_row(area, detail)
    console.print(built)
    console.print()

    checks = ["isVipActive", "purchaseVipPass", "claimVipTrial", "vipTableWinBonus", "daily-rewards-vip"]
    missing = [c for c in checks if c not in html]
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    ok = proc.returncode == 0 and not missing
    if missing:
        console.print(Text(f"Missing: {', '.join(missing)}", style="bold red"))
    console.print(Text(f"Tests: {'PASS' if ok else 'FAIL'}", style="bold green" if ok else "bold red"))
    console.print("[dim]In-game: Daily Rewards [8] → VIP Pass section[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())