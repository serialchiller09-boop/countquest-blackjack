"""
Shared enums and type aliases for CountQuest Blackjack.
"""

from __future__ import annotations

from enum import IntEnum, Enum


class HelpLevel(IntEnum):
    """
    Progressive training tiers — 0 is maximum help, 4 is expert simulation.

    Stored in player progress and drives the HelpSystem visibility rules.
    """

    NOVICE = 0       # Full counts, strategy, bet, post-hand coaching
    GUIDED = 1       # Count confirm each round; strategy on mistakes; bet range
    PRACTICE = 2     # Hidden count in play; post-hand count quiz; mistake hints
    CHALLENGE = 3    # No in-play help; post-shoe analytics; strategy on request
    EXPERT = 4       # Pure simulation; session-end analytics only

    @property
    def label(self) -> str:
        return {
            HelpLevel.NOVICE: "Novice (Level 0)",
            HelpLevel.GUIDED: "Guided (Level 1)",
            HelpLevel.PRACTICE: "Practice (Level 2)",
            HelpLevel.CHALLENGE: "Challenge (Level 3)",
            HelpLevel.EXPERT: "Expert (Level 4)",
        }[self]


class Suit(str, Enum):
    """The four standard French suits."""

    SPADES = "S"
    HEARTS = "H"
    DIAMONDS = "D"
    CLUBS = "C"

    def symbol(self) -> str:
        """Unicode suit symbol for console display."""
        return {
            Suit.SPADES: "♠",
            Suit.HEARTS: "♥",
            Suit.DIAMONDS: "♦",
            Suit.CLUBS: "♣",
        }[self]


class Rank(str, Enum):
    """
    Card ranks from deuce through ace.

    String values match real card faces (10, J, Q, K, A).
    """

    TWO = "2"
    THREE = "3"
    FOUR = "4"
    FIVE = "5"
    SIX = "6"
    SEVEN = "7"
    EIGHT = "8"
    NINE = "9"
    TEN = "10"
    JACK = "J"
    QUEEN = "Q"
    KING = "K"
    ACE = "A"

    @property
    def is_ten_value(self) -> bool:
        """True for 10, J, Q, K — all count as ten in hand totals."""
        return self in {Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING}

    @property
    def is_low_hi_lo(self) -> bool:
        """Hi-Lo 'low' cards (2–6) that add +1 to the running count."""
        return self in {
            Rank.TWO,
            Rank.THREE,
            Rank.FOUR,
            Rank.FIVE,
            Rank.SIX,
        }

    @property
    def is_neutral_hi_lo(self) -> bool:
        """Hi-Lo 'neutral' cards (7–9) that do not change the running count."""
        return self in {Rank.SEVEN, Rank.EIGHT, Rank.NINE}

    @property
    def is_high_hi_lo(self) -> bool:
        """Hi-Lo 'high' cards (10–A) that subtract 1 from the running count."""
        return self.is_ten_value or self == Rank.ACE