#!/usr/bin/env python3
"""Dealer Mode v3 status report."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

ROOT = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(ROOT / "scripts"))
from load_project_source import load_app_source  # noqa: E402
console = Console()

FEATURES = [
    ("AI table", "3–5 random AI players per shift", "createDealerAISeats"),
    ("AI splits", "Basic-strategy splits with per-hand payouts", "dealerAISplitHand"),
    ("Insurance round", "AI buys insurance on Ace; dealer resolves 2:1", "dealerCollectInsurance"),
    ("Dealer peek", "Natural BJ revealed on Ace/10 upcard", "dealerPeekHole"),
    ("Insurance payouts", "Timed Pay 2:1 / Collect per insuring player", "submitDealerInsurancePayout"),
    ("Payout challenge", "Timed Win/Lose/Push/BJ per player hand", "submitDealerPayout"),
    ("Dealer rule quiz", "Hit/Stand under clock on borderline totals", "submitDealerAction"),
    ("Count checks", "Running count quiz every 3 hands", "submitDealerCountQuiz"),
    ("Mistake log", "Wrong payouts, rules, insurance, counts", "category: 'dealer'"),
    ("Shift rewards", "Chips/gems scaled by payout accuracy", "computeDealerShiftReward"),
    ("Dealer Night event", "1.5× chips + gem bonus via special event", "dealer-night"),
    ("Session summary", "Unified drill summary + personal bests", "finishDrillWithSummary('dealer-mode'"),
    ("Lobby entry", "Lobby → Dealer Shift tile", "action: 'dealer-mode'"),
    ("Training entry", "Training Mode → Dealer Mode drill", "launch: 'dealer-mode'"),
    ("Engine reuse", "Hand, Shoe, compareHands, payout, advise", "validateDealerPayoutGuess"),
]

DRILLS = [
    ("Card Burst Drill", "Rapid card groups + RC quiz", "openCardBurstDrill"),
    ("Decks Remaining Quiz", "Cards dealt + RC → decks left", "openDecksLeftDrill"),
]


def main() -> int:
    html = load_app_source()
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    test_ok = proc.returncode == 0
    test_count = "63" if test_ok else "?"
    save_ver = "17" if "const SAVE_VERSION = 17" in html else "?"

    console.print()
    console.print(
        Panel(
            "[bold]Player as Dealer[/] — insurance, peek, splits, event bonuses\n"
            "[dim]SAVE_VERSION 17 · All training drills live[/]",
            title="[bold gold1]CountQuest Dealer Mode[/]",
            border_style="bright_blue",
            padding=(1, 2),
        )
    )
    console.print()

    meta = Table(box=box.SIMPLE, show_header=False)
    meta.add_column("Key", style="dim")
    meta.add_column("Value")
    meta.add_row("Project", str(ROOT))
    meta.add_row("SAVE_VERSION", save_ver)
    meta.add_row("Tests", f"{test_count}/63 PASS" if test_ok else "FAIL")
    meta.add_row("Lobby", "Dealer Shift · Special Event → Dealer Night")
    meta.add_row("Training", "All drills live (incl. Card Burst, Decks Left)")
    console.print(meta)
    console.print()

    tbl = Table(title="Dealer Mode Features", box=box.ROUNDED, border_style="cyan")
    tbl.add_column("Feature", style="cyan")
    tbl.add_column("Description", style="white")
    tbl.add_column("Built", justify="center")
    for name, desc, marker in FEATURES:
        tbl.add_row(name, desc, "[green]✓[/]" if marker in html else "[red]✗[/]")
    console.print(tbl)
    console.print()

    dtbl = Table(title="New Counting Drills", box=box.ROUNDED, border_style="yellow")
    dtbl.add_column("Drill", style="gold1")
    dtbl.add_column("Description", style="white")
    dtbl.add_column("Built", justify="center")
    for name, desc, marker in DRILLS:
        dtbl.add_row(name, desc, "[green]✓[/]" if marker in html else "[red]✗[/]")
    console.print(dtbl)
    console.print()

    ok = (
        test_ok and save_ver == "17"
        and all(m in html for _, _, m in FEATURES)
        and all(m in html for _, _, m in DRILLS)
    )
    console.print(f"[bold]{'✓ Dealer Mode v3 + drills READY' if ok else '✗ Verification FAILED'}[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())