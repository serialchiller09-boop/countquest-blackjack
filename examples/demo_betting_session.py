#!/usr/bin/env python3
"""
Verify bet suggestions rise as true count climbs.

    python examples/demo_betting_session.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from countquest.betting import suggest_bet


def main() -> None:
    bankroll = 2000
    unit = 10
    min_bet = 10

    print("CountQuest — bet suggestion vs true count")
    print(f"Bankroll ${bankroll}, unit ${unit}, max 10% = ${bankroll // 10}\n")
    print(f"{'True Count':>12}  {'Units':>6}  {'Suggested':>10}  Capped?")
    print("-" * 44)

    for tc in [-2.0, 0.0, 0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0]:
        s = suggest_bet(tc, bankroll=bankroll, unit_size=unit, min_bet=min_bet)
        cap = "yes" if s.capped_by_bankroll else "no"
        sign = "+" if tc >= 0 else ""
        print(f"{sign}{tc:>11.1f}  {s.units:>6}  ${s.amount:>9}  {cap:>6}")

    print("\nAs true count rises from 0 → +5, suggestion goes $10 → $60.")


if __name__ == "__main__":
    main()