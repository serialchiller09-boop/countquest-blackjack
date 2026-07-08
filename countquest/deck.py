"""
Multi-deck shoe — the heart of realistic counting practice.

Real casinos do not reshuffle after every hand. They deal from a large
"multi-deck shoe" (often 6 or 8 decks). Card counters care about:

  1. **How many cards are left** — used to convert "running count" into
     "true count" (running count ÷ decks remaining).
  2. **Penetration** — how deep the dealer deals before reshuffling.
     Deeper penetration means more reliable true-count estimates.

This module builds, shuffles, deals from, and tracks that shoe.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from countquest.card import Card
from countquest.models import Rank, Suit

# One full 52-card deck in a consistent order before shuffling.
_SINGLE_DECK: tuple[Card, ...] = tuple(
    Card(rank=rank, suit=suit)
    for suit in Suit
    for rank in Rank
)


@dataclass
class Shoe:
    """
    A multi-deck shoe with shuffle, deal, and penetration tracking.

    Args:
        num_decks: Number of standard 52-card decks in the shoe (casino default: 6).
        penetration: Fraction of the shoe that may be dealt before a reshuffle
            is required. ``0.75`` means "deal until only 25% of cards remain."
            Also called "75% penetration" in casino jargon.
        burn_on_shuffle: If True, remove one card face-down after each shuffle,
            mimicking the burn card real dealers place before play begins.
            Counters usually never see the burn card, but it *does* leave the
            shoe and affects how many cards remain for true-count math.
    """

    num_decks: int = 6
    penetration: float = 0.75
    burn_on_shuffle: bool = True

    # Internal state — rebuilt on every shuffle/reset.
    _cards: list[Card] = field(default_factory=list, repr=False)
    _initial_count: int = field(default=0, repr=False)
    _burned_cards: list[Card] = field(default_factory=list, repr=False)

    def __post_init__(self) -> None:
        if self.num_decks < 1:
            raise ValueError("num_decks must be at least 1")
        if not 0.0 < self.penetration < 1.0:
            raise ValueError("penetration must be between 0 and 1 (exclusive)")
        self.reset()

    # ------------------------------------------------------------------
    # Shoe lifecycle
    # ------------------------------------------------------------------

    def reset(self) -> None:
        """
        Build a fresh shoe, shuffle it, and optionally burn one card.

        Call this when:
          - A new practice session starts
          - ``needs_reshuffle()`` returns True mid-session
        """
        self._burned_cards.clear()
        self._cards = list(_SINGLE_DECK) * self.num_decks
        self._initial_count = len(self._cards)
        self.shuffle()

        if self.burn_on_shuffle and self._cards:
            burned = self._cards.pop(0)  # top of shoe, as in a real deal
            self._burned_cards.append(burned)

    def shuffle(self) -> None:
        """
        Randomize card order in the current shoe.

        Uses ``random.shuffle`` (Fisher–Yates). We reshuffle the *existing*
        pile rather than rebuilding so callers can re-order without resetting
        stats if needed — but ``reset()`` is the usual entry point.
        """
        random.shuffle(self._cards)

    # ------------------------------------------------------------------
    # Dealing
    # ------------------------------------------------------------------

    def deal(self) -> Card:
        """
        Remove and return the next card from the top of the shoe.

        Raises:
            IndexError: If the shoe is empty. Check ``needs_reshuffle()`` or
                ``cards_remaining`` before dealing in production game code.
        """
        if not self._cards:
            raise IndexError("Shoe is empty — call reset() to reshuffle")
        return self._cards.pop(0)

    def deal_if_available(self) -> Card | None:
        """Like ``deal()``, but returns ``None`` instead of raising when empty."""
        if not self._cards:
            return None
        return self.deal()

    # ------------------------------------------------------------------
    # Tracking — critical for true count and penetration
    # ------------------------------------------------------------------

    @property
    def initial_count(self) -> int:
        """Total cards in a fresh shoe (before the burn card is removed)."""
        return self._initial_count

    @property
    def cards_remaining(self) -> int:
        """Cards still in the shoe (not yet dealt or burned)."""
        return len(self._cards)

    @property
    def cards_dealt(self) -> int:
        """
        Cards removed from the shoe since the last ``reset()``.

        Includes burned cards — they left the shoe even if the player never
        saw them, which is why we count them here for accurate deck estimates.
        """
        return self.initial_count - self.cards_remaining

    @property
    def burned_cards(self) -> tuple[Card, ...]:
        """Burned cards from the most recent shuffle (read-only copy)."""
        return tuple(self._burned_cards)

    def decks_remaining(self) -> float:
        """
        Estimate full decks still in the shoe.

        True count = running_count / decks_remaining.

        We use a float (e.g. 3.25 decks) rather than rounding to an integer
        because counters gain accuracy from fractional deck estimates.
        Returns ``0.0`` when the shoe is empty.
        """
        if self.cards_remaining == 0:
            return 0.0
        return self.cards_remaining / 52.0

    def remaining_fraction(self) -> float:
        """Fraction of the original shoe still undealt (0.0 to 1.0)."""
        if self.initial_count == 0:
            return 0.0
        return self.cards_remaining / self.initial_count

    def needs_reshuffle(self) -> bool:
        """
        Return True when the cut-card point has been reached.

        Example with ``penetration=0.75`` on a 6-deck shoe (312 cards):
          - Deal until ~234 cards are gone (75% penetration)
          - When ≤ 78 cards remain (25% of shoe), return True

        Casinos reshuffle here so counters cannot see deep into the next shoe.
        """
        return self.remaining_fraction() <= (1.0 - self.penetration)

    # ------------------------------------------------------------------
    # Display helpers
    # ------------------------------------------------------------------

    def summary(self) -> str:
        """One-line status string for debugging or console HUD."""
        return (
            f"Shoe: {self.cards_remaining}/{self.initial_count} cards "
            f"({self.decks_remaining():.2f} decks left, "
            f"penetration limit {self.penetration:.0%})"
        )