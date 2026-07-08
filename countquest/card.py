"""
Single playing card — the atomic unit of the shoe and the count.

Every card counter update starts here: one revealed card → one Hi-Lo tag.
"""

from __future__ import annotations

from dataclasses import dataclass

from countquest.models import Rank, Suit


@dataclass(frozen=True, slots=True)
class Card:
    """
    An immutable playing card.

    ``frozen=True`` prevents accidental mutation mid-hand, which would corrupt
    both hand totals and the running count history.
    """

    rank: Rank
    suit: Suit

    def hi_lo_value(self) -> int:
        """
        Return this card's Hi-Lo counting tag.

        Hi-Lo system (most common beginner count):
          - Low cards (2, 3, 4, 5, 6) → +1  (removing them favors the player)
          - Neutral (7, 8, 9)         →  0
          - High cards (10, J, Q, K, A) → -1 (removing them favors the dealer)

        When lots of low cards leave the shoe, more high cards remain,
        which slightly increases the player's edge — that is what we track.
        """
        if self.rank.is_low_hi_lo:
            return 1
        if self.rank.is_neutral_hi_lo:
            return 0
        return -1

    def display(self) -> str:
        """Short text for console output, e.g. ``A♠`` or ``10♥``."""
        return f"{self.rank.value}{self.suit.symbol()}"

    def __str__(self) -> str:
        return self.display()