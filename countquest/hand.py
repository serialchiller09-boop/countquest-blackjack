"""
Hand evaluation for player and dealer.

Blackjack hand totals are trickier than they look because Aces can count as
1 or 11. This module centralizes that logic so Game and HelpSystem stay simple.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from countquest.card import Card
from countquest.models import Rank


class HandResult(str, Enum):
    """Outcome of a completed hand from the *player's* perspective."""

    WIN = "win"
    LOSS = "loss"
    PUSH = "push"
    BLACKJACK = "blackjack"  # Natural 21 on first two cards (special payout)


@dataclass
class Hand:
    """
    A collection of cards belonging to one player or the dealer.

    Cards are stored in deal order. Use ``add()`` when the player hits or
    when the dealer draws additional cards.
    """

    cards: list[Card] = field(default_factory=list)

    # ------------------------------------------------------------------
    # Building the hand
    # ------------------------------------------------------------------

    def add(self, card: Card) -> None:
        """Add a card to the hand (hit, deal, etc.)."""
        self.cards.append(card)

    def clear(self) -> None:
        """Remove all cards — used when starting a new round."""
        self.cards.clear()

    @property
    def size(self) -> int:
        return len(self.cards)

    # ------------------------------------------------------------------
    # Totals — the core ace logic
    # ------------------------------------------------------------------

    def raw_value(self) -> int:
        """
        Naive hand total treating every Ace as 11.

        Used internally before we downgrade Aces to 1 as needed.
        """
        total = 0
        aces = 0
        for card in self.cards:
            if card.rank == Rank.ACE:
                aces += 1
                total += 11
            elif card.rank.is_ten_value:
                total += 10
            else:
                total += int(card.rank.value)
        return total, aces

    def value(self) -> int:
        """
        Best legal blackjack total (Aces as 1 or 11).

        Algorithm:
          1. Start with all Aces as 11.
          2. While total > 21 and Aces remain, convert one Ace from 11 → 1
             (subtract 10) and repeat.

        Edge case — multiple Aces:
          A, A, 9 → raw 11+11+9 = 31 → downgrade one Ace → 21 (soft then hard).
          A, A, A, 8 → best total 21 (one Ace as 11, two as 1).
          Five Aces is impossible in one hand in practice, but the loop
          handles any count correctly.
        """
        total, aces = self.raw_value()
        while total > 21 and aces > 0:
            total -= 10
            aces -= 1
        return total

    def is_soft(self) -> bool:
        """
        True if at least one Ace is currently counted as 11 without busting.

        Example: A + 6 = 17 soft (could become 7 hard with another bad draw).
        A + 10 is NOT soft — the Ace must be 1 to avoid bust (hard 21).

        Insurance (future): dealer Ace upcard + soft player hands do not
        change insurance math, but a soft total tells the UI to show both
        possible values to the learner.
        """
        total, aces = self.raw_value()
        # An Ace counts as 11 only if we have not downgraded it yet.
        return aces > 0 and total <= 21

    def is_hard(self) -> bool:
        """True when no Ace is flexibly counting as 11 (or hand has no Aces)."""
        return not self.is_soft()

    # ------------------------------------------------------------------
    # Special states
    # ------------------------------------------------------------------

    def is_blackjack(self) -> bool:
        """
        Natural blackjack: exactly two cards totaling 21.

        A + 10/J/Q/K qualifies.  A + 9 + A does NOT — that took three cards.
        Split hands (future) that receive a 10-value on an Ace are paid 1:1,
        not 3:2 — we will check ``is_blackjack()`` only on the initial two cards.
        """
        return self.size == 2 and self.value() == 21

    def is_bust(self) -> bool:
        """True when best total exceeds 21."""
        return self.value() > 21

    def is_twenty_one(self) -> bool:
        """True on any 21 (including non-natural and post-hit 21)."""
        return self.value() == 21

    # ------------------------------------------------------------------
    # Display
    # ------------------------------------------------------------------

    def display(self, hide_hole: bool = False) -> str:
        """
        Format cards for the console.

        ``hide_hole=True`` masks the second dealer card (``??``) before the
        dealer's turn — standard casino presentation.
        """
        if not self.cards:
            return "(empty)"
        parts: list[str] = []
        for index, card in enumerate(self.cards):
            if hide_hole and index == 1:
                parts.append("??")
            else:
                parts.append(card.display())
        return " ".join(parts)

    def summary(self, hide_hole: bool = False) -> str:
        """Cards plus total, e.g. ``A♠ 10♥ = 21 (blackjack)``."""
        label = self.display(hide_hole=hide_hole)
        if hide_hole and self.size >= 2:
            # Only show upcard value before hole is revealed.
            shown_total = self.cards[0].rank.is_ten_value or self.cards[0].rank == Rank.ACE
            up_value = (
                11
                if self.cards[0].rank == Rank.ACE
                else 10
                if self.cards[0].rank.is_ten_value
                else int(self.cards[0].rank.value)
            )
            return f"{label} = {up_value}+?"
        tags: list[str] = []
        total = self.value()
        if self.is_blackjack():
            tags.append("blackjack")
        elif self.is_bust():
            tags.append("bust")
        elif self.is_soft():
            tags.append("soft")
        else:
            tags.append("hard")
        tag_str = f" ({', '.join(tags)})" if tags else ""
        return f"{label} = {total}{tag_str}"


# ------------------------------------------------------------------
# Outcome & payout helpers
# ------------------------------------------------------------------


def compare_hands(player: Hand, dealer: Hand) -> HandResult:
    """
    Determine the result of a completed hand from the player's view.

    Assumes both hands are finished (no further hits). Call order:

      1. If player bust → LOSS (dealer need not play).
      2. If player natural blackjack:
           - Dealer also blackjack → PUSH
           - Otherwise → BLACKJACK (3:2 payout)
      3. If dealer bust → WIN
      4. Compare totals → WIN / LOSS / PUSH

    Edge case — dealer Ace upcard (insurance later):
      Insurance is decided *before* dealer peeks. This function runs after
      the full hand; peek logic will live in ``Game`` when we add it.
    """
    if player.is_bust():
        return HandResult.LOSS

    player_bj = player.is_blackjack()
    dealer_bj = dealer.is_blackjack()

    if player_bj and dealer_bj:
        return HandResult.PUSH
    if player_bj:
        return HandResult.BLACKJACK

    if dealer.is_bust():
        return HandResult.WIN

    player_total = player.value()
    dealer_total = dealer.value()

    if player_total > dealer_total:
        return HandResult.WIN
    if player_total < dealer_total:
        return HandResult.LOSS
    return HandResult.PUSH


def calculate_payout(
    bet: int,
    result: HandResult,
    blackjack_payout: float = 1.5,
) -> int:
    """
    Return the *net* chips won or lost for this hand.

    Payout rules (standard):
      - Blackjack (natural): ``+bet * 1.5``  (3:2 — bet $10 → win $15 profit)
      - Win:               ``+bet``         (1:1)
      - Push:              ``0``
      - Loss:              ``-bet``

    ``blackjack_payout`` is the profit multiplier, not including return of the
    original wager (casino pays 3:2 *on top of* your bet back at settlement;
    here we return net change to bankroll after the bet was already deducted).
    """
    if bet < 0:
        raise ValueError("bet must be non-negative")

    if result == HandResult.BLACKJACK:
        return int(bet * blackjack_payout)
    if result == HandResult.WIN:
        return bet
    if result == HandResult.PUSH:
        return 0
    return -bet