#!/usr/bin/env python3
"""
Quick demo: deal 20 cards from a 6-deck shoe and print the running Hi-Lo count.

Run from the project root:

    python examples/demo_shoe_count.py

Or:

    python -m examples.demo_shoe_count   # if package path is configured
"""

from __future__ import annotations

import sys
from pathlib import Path

# Allow running this file directly without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from countquest.card import Card
from countquest.deck import Shoe


def main() -> None:
    shoe = Shoe(num_decks=6, penetration=0.75, burn_on_shuffle=True)

    print(shoe.summary())
    if shoe.burned_cards:
        burned = shoe.burned_cards[0]
        print(f"Burn card (removed unseen): {burned}")
    print()

    running_count = 0
    cards_to_deal = 20

    for i in range(1, cards_to_deal + 1):
        card: Card = shoe.deal()
        running_count += card.hi_lo_value()

        tag = f"{card.hi_lo_value():+d}"
        print(
            f"Card {i:2d}: {card.display():>3}  "
            f"tag {tag:>3}  "
            f"running count = {running_count:+3d}  "
            f"({shoe.cards_remaining} left)"
        )

    print()
    print(f"Final running count after {cards_to_deal} cards: {running_count:+d}")
    print(f"Decks remaining: {shoe.decks_remaining():.2f}")
    print(f"Needs reshuffle? {shoe.needs_reshuffle()}")


if __name__ == "__main__":
    main()