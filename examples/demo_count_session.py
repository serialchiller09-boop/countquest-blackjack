#!/usr/bin/env python3
"""
Simulated session that prints Hi-Lo count after every card and each hand.

Run from project root:

    python examples/demo_count_session.py

This does not require keyboard input — use it to verify counting math.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from countquest.counter import HiLoCounter
from countquest.deck import Shoe
from countquest.hand import Hand


def print_count(counter: HiLoCounter, shoe: Shoe, note: str = "") -> None:
    info = counter.get_count_info(shoe)
    suffix = f"  ← {note}" if note else ""
    print(f"  [Count] {info.formatted()}{suffix}")


def deal(counter: HiLoCounter, shoe: Shoe, hand: Hand, label: str) -> None:
    card = shoe.deal()
    tag = counter.observe(card)
    hand.add(card)
    print(f"    Deal {label}: {card.display()} (tag {tag:+d})")
    print_count(counter, shoe)


def play_demo_hand(
    hand_number: int,
    shoe: Shoe,
    counter: HiLoCounter,
) -> None:
    print(f"\n{'=' * 60}")
    print(f"HAND {hand_number}")
    print("=" * 60)

    player = Hand()
    dealer = Hand()

    # Initial four cards (standard order).
    deal(counter, shoe, player, "player")
    deal(counter, shoe, dealer, "dealer up")
    deal(counter, shoe, player, "player")
    deal(counter, shoe, dealer, "dealer hole")

    print(f"  Player: {player.summary()}")
    print(f"  Dealer: {dealer.summary(hide_hole=True)} (hole hidden on table)")
    print_count(counter, shoe, "after initial deal")

    # Simulate: player hits once, stands; dealer draws one card.
    deal(counter, shoe, player, "player hit")
    print(f"  Player after hit: {player.summary()}")

    deal(counter, shoe, dealer, "dealer hit")
    print(f"  Dealer final: {dealer.summary()}")

    info = counter.get_count_info(shoe)
    print(f"\n  >>> END OF HAND {hand_number}: {info.formatted()}")


def main() -> None:
    shoe = Shoe(num_decks=6, penetration=0.75, burn_on_shuffle=True)
    counter = HiLoCounter()

    print("CountQuest — Hi-Lo count verification session")
    print(shoe.summary())

    for burned in shoe.burned_cards:
        tag = counter.observe(burned)
        print(f"Burn card: {burned.display()} (tag {tag:+d})")
    print_count(counter, shoe, "after burn")

    for hand_num in range(1, 4):
        play_demo_hand(hand_num, shoe, counter)

    print("\n" + "=" * 60)
    print("SESSION COMPLETE")
    print_count(counter, shoe, "final session count")
    print("=" * 60)


if __name__ == "__main__":
    main()