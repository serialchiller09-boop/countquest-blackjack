#!/usr/bin/env python3
"""Display CountQuest club economy — bankroll, top-3 payouts, invite codes, OAuth/IAP."""

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

FEATURES = [
    ("Shared crew bankroll", "club.bankroll — contribute chips/gems, leader distribute"),
    ("Weekly top-3 payouts", "🥇 500+2💎 · 🥈 300+1💎 · 🥉 150🪙 at week rollover"),
    ("Invite codes", "6-char codes · join private crews · leader regenerate"),
    ("OAuth wiring", "Google GIS + Facebook SDK when client IDs in Settings"),
    ("IAP wiring", "Stripe payment link opens checkout · return ?vip_purchased=1"),
]


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]Club Economy + External Services[/]\n[dim]Bankroll · weekly payouts · invites · OAuth/IAP[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="bright_green",
        )
    )
    console.print()

    table = Table(title="Implemented Features", border_style="green", header_style="bold gold1")
    table.add_column("Feature", style="cyan", min_width=22)
    table.add_column("Detail", style="white")
    for feat, detail in FEATURES:
        table.add_row(feat, detail)
    console.print(table)
    console.print()

    payouts = Table(title="Weekly Top-3 Payouts", border_style="yellow")
    payouts.add_column("Place", style="cyan")
    payouts.add_column("Reward", style="green")
    for row in [("🥇 1st", "500 chips + 2 gems"), ("🥈 2nd", "300 chips + 1 gem"), ("🥉 3rd", "150 chips")]:
        payouts.add_row(row[0], row[1])
    console.print(payouts)
    console.print()

    checks = [
        "contributeToClubBankroll",
        "joinClubByInviteCode",
        "processWeeklyTop3Payouts",
        "ExternalAuth",
        "ExternalIAP",
        "club-hub-bankroll",
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
    console.print("[dim]In-game: [7] Counting Crews → bankroll · invite · top-3 history[/]")
    console.print("[dim]Settings → OAuth & IAP (developer) for real providers[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())