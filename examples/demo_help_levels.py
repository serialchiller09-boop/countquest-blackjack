#!/usr/bin/env python3
"""Print what each help level shows — no input required."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from countquest.help_system import HelpSystem
from countquest.models import HelpLevel


def main() -> None:
    print("CountQuest — Help level visibility matrix\n")
    flags = [
        ("Count during play", lambda h: h.show_count_during_play()),
        ("Per-card count updates", lambda h: h.show_per_card_count_updates()),
        ("Exact bet suggestion", lambda h: h.show_exact_bet()),
        ("Bet range", lambda h: h.show_bet_range()),
        ("Strategy always", lambda h: h.show_strategy_always()),
        ("Strategy on mistake/close", lambda h: h.show_strategy_on_mistake_or_close()),
        ("Strategy chart command", lambda h: h.allow_strategy_chart()),
        ("Post-hand count quiz", lambda h: h.post_hand_count_quiz()),
        ("Post-hand coaching", lambda h: h.post_hand_full_explanation()),
        ("Post-shoe report", lambda h: h.post_shoe_summary()),
        ("Expert analytics only", lambda h: h.expert_session_analytics_only()),
    ]

    header = f"{'Feature':<28}" + "".join(f" L{int(l)} " for l in HelpLevel)
    print(header)
    print("-" * len(header))
    for name, fn in flags:
        row = f"{name:<28}"
        for level in HelpLevel:
            h = HelpSystem(level)
            row += " yes " if fn(h) else "  -  "
        print(row)

    print("\nSwitch in-game: type 'level N' at bet or move prompt (0–4).")
    print("Progress saved to data/progress.json")


if __name__ == "__main__":
    main()