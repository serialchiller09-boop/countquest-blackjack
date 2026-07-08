"""
Hi-Lo counting engine.

Hi-Lo is the most common beginner counting system:

  Low cards (2,3,4,5,6) → +1   Removing these leaves more high cards → player edge
  Neutral (7,8,9)       →  0
  High cards (10,J,Q,K,A) → -1  Removing these leaves more low cards → house edge

**Running count** adds these tags as cards leave the shoe.

**True count** = running_count ÷ decks_remaining

Why true count matters:
  A running count of +6 means very different things in a 6-deck shoe with
  5 decks left (+1.2 true) vs. half a deck left (+12 true). Bet sizing and
  strategy adjustments use *true* count, not running count alone.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from countquest.card import Card
from countquest.deck import Shoe

# Avoid division blow-ups when the shoe is nearly empty.
_MIN_DECKS_FOR_TRUE_COUNT = 0.5


@dataclass(frozen=True, slots=True)
class CountInfo:
    """Snapshot of count state for display, betting, and quizzes."""

    running_count: int
    true_count: float
    decks_remaining: float
    cards_seen: int

    def formatted(self) -> str:
        sign = "+" if self.running_count >= 0 else ""
        tc_sign = "+" if self.true_count >= 0 else ""
        return (
            f"Running: {sign}{self.running_count}  |  "
            f"True: {tc_sign}{self.true_count:.1f}  |  "
            f"Decks left: {self.decks_remaining:.2f}  |  "
            f"Cards seen: {self.cards_seen}"
        )


@dataclass
class HiLoCounter:
    """
    Tracks Hi-Lo running count as cards are observed.

    Call ``observe()`` every time a card leaves the shoe — including burn
    cards and the dealer hole card before it is shown. That matches how
    the cards physically left the pack even if the player has not seen them yet.
    """

    running_count: int = 0
    cards_seen: int = 0

    def reset(self) -> None:
        """Zero the count when a fresh shoe is shuffled."""
        self.running_count = 0
        self.cards_seen = 0

    def observe(self, card: Card) -> int:
        """
        Apply one card's Hi-Lo tag to the running count.

        Returns:
            The tag value (+1, 0, or -1) for optional per-card logging.
        """
        tag = card.hi_lo_value()
        self.running_count += tag
        self.cards_seen += 1
        return tag

    def true_count(self, decks_remaining: float) -> float:
        """
        Convert running count to true count.

        Uses a floor on decks remaining so we never divide by zero near the
        cut card. Counters often round true count to the nearest half or
        whole number for betting — we keep one decimal for the trainer.
        """
        divisor = max(decks_remaining, _MIN_DECKS_FOR_TRUE_COUNT)
        return self.running_count / divisor

    def get_count_info(self, shoe: Shoe) -> CountInfo:
        """Build a full count snapshot tied to the current shoe state."""
        decks = shoe.decks_remaining()
        return CountInfo(
            running_count=self.running_count,
            true_count=self.true_count(decks),
            decks_remaining=decks,
            cards_seen=self.cards_seen,
        )


@dataclass
class CountAccuracyTracker:
    """
    Tracks how often the player guesses the running count correctly.

    Used for progression and help-level unlocks later. Tolerance defaults
    to ±1 because live-game estimates are rarely exact.
    """

    tolerance: int = 1
    correct_guesses: int = 0
    total_guesses: int = 0

    def record_guess(self, guess: int, actual_running: int) -> bool:
        """
        Compare player guess to actual running count.

        Returns:
            True if the guess was within ``tolerance``.
        """
        self.total_guesses += 1
        correct = abs(guess - actual_running) <= self.tolerance
        if correct:
            self.correct_guesses += 1
        return correct

    @property
    def accuracy_percent(self) -> float:
        if self.total_guesses == 0:
            return 0.0
        return 100.0 * self.correct_guesses / self.total_guesses

    def summary(self) -> str:
        if self.total_guesses == 0:
            return "Count accuracy: no guesses yet"
        return (
            f"Count accuracy: {self.correct_guesses}/{self.total_guesses} "
            f"({self.accuracy_percent:.0f}%)"
        )