"""
Basic strategy advisor — mathematically optimal play vs dealer upcard.

Basic strategy is the pre-computed best action for every player hand vs every
dealer upcard, assuming:
  - Multi-deck shoe (6–8 decks)
  - Dealer hits soft 17 (common Vegas rules)
  - Double on any two cards; double after split allowed
  - No surrender (not in our MVP)

It does NOT account for the count — that comes later ("deviations").
These plays minimize the house edge at neutral count (~0.5%).

Notation in comments:
  H = Hit, S = Stand, D = Double (else Hit), P = Split (else Hit)
  "D" means: double if allowed; if you already have 3+ cards, hit instead.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from countquest.hand import Hand
from countquest.models import Rank


class StrategyAction(str, Enum):
    HIT = "hit"
    STAND = "stand"
    DOUBLE = "double"
    SPLIT = "split"


@dataclass(frozen=True, slots=True)
class StrategyAdvice:
    """Recommended play plus a short lesson on why."""

    action: StrategyAction
    rationale: str

    def formatted(self) -> str:
        return f"Basic strategy → {self.action.value.upper()}: {self.rationale}"


def dealer_upcard_value(rank: Rank) -> int:
    """Dealer upcard as strategy charts label (2–10, Ace = 11)."""
    if rank == Rank.ACE:
        return 11
    if rank.is_ten_value:
        return 10
    return int(rank.value)


def _up(dealer: int) -> str:
    """Readable dealer label for rationales."""
    return "Ace" if dealer == 11 else str(dealer)


class BasicStrategy:
    """Static advisor — call ``advise()`` at decision time."""

    @staticmethod
    def advise(
        player: Hand,
        dealer_up: Rank,
        *,
        can_double: bool,
        can_split: bool,
    ) -> StrategyAdvice:
        """
        Return the best action and a one-line explanation.

        Respects ``can_double`` / ``can_split`` — if the book play is Double
        but doubling is unavailable, we fall back to Hit (standard fallback).
        """
        dealer = dealer_upcard_value(dealer_up)

        # --- Pairs (only when exactly two cards of the same rank) ---
        if (
            can_split
            and player.size == 2
            and player.cards[0].rank == player.cards[1].rank
        ):
            pair_advice = _pair_strategy(player.cards[0].rank, dealer)
            if pair_advice.action == StrategyAction.SPLIT:
                return pair_advice
            # 5,5 is never split — fall through to hard-total logic as 10.

        # --- Soft hands (Ace counted as 11) ---
        if player.is_soft():
            soft_advice = _soft_strategy(player.value(), dealer)
            return _apply_double_fallback(soft_advice, can_double)

        # --- Hard totals ---
        hard_advice = _hard_strategy(player.value(), dealer)
        return _apply_double_fallback(hard_advice, can_double)


def _apply_double_fallback(advice: StrategyAdvice, can_double: bool) -> StrategyAdvice:
    """
    Charts say "Dh" (double if allowed, else hit) — the most common fallback.
    """
    if advice.action == StrategyAction.DOUBLE and not can_double:
        return StrategyAdvice(
            action=StrategyAction.HIT,
            rationale=advice.rationale + " (can't double → hit instead)",
        )
    return advice


# ------------------------------------------------------------------
# Pair splitting
# ------------------------------------------------------------------


def _pair_strategy(rank: Rank, dealer: int) -> StrategyAdvice:
    d = _up(dealer)

    # Always split Aces — two shots at blackjack beat one soft 12.
    if rank == Rank.ACE:
        return StrategyAdvice(
            StrategyAction.SPLIT,
            f"Split Aces vs dealer {d} — maximize blackjack chances.",
        )

    # 8,8: split — 16 is a terrible hand; two eights fight better.
    if rank == Rank.EIGHT:
        return StrategyAdvice(
            StrategyAction.SPLIT,
            f"Split 8s vs dealer {d} — 16 loses too often; 8 is salvageable.",
        )

    # 10-value pairs: never split 20.
    if rank.is_ten_value:
        return StrategyAdvice(
            StrategyAction.STAND,
            f"Stand on 20 vs dealer {d} — already a huge favorite.",
        )

    # 9,9: split except vs 7, 10, Ace (you're already ahead vs 7).
    if rank == Rank.NINE:
        if dealer in {7, 10, 11}:
            return StrategyAdvice(
                StrategyAction.STAND,
                f"Stand on 18 vs dealer {d} — strong enough; don't break it up.",
            )
        return StrategyAdvice(
            StrategyAction.SPLIT,
            f"Split 9s vs dealer {d} — two 9s beat one 18 here.",
        )

    # 7,7: split vs 2–7.
    if rank == Rank.SEVEN:
        if 2 <= dealer <= 7:
            return StrategyAdvice(
                StrategyAction.SPLIT,
                f"Split 7s vs dealer {d} — weak 14; two 7s can improve.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit 14 vs dealer {d} — splitting into weak hands vs strong upcard.",
        )

    # 6,6: split vs 2–6 (dealer bust zone).
    if rank == Rank.SIX:
        if 2 <= dealer <= 6:
            return StrategyAdvice(
                StrategyAction.SPLIT,
                f"Split 6s vs dealer {d} — dealer likely busts; two chances to win.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit 12 vs dealer {d} — dealer too strong to split profitably.",
        )

    # 4,4: split only vs 5–6 (dealer very weak); else hit 8.
    if rank == Rank.FOUR:
        if dealer in {5, 6}:
            return StrategyAdvice(
                StrategyAction.SPLIT,
                f"Split 4s vs dealer {d} — dealer weak; two hands can outdraw them.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit 8 vs dealer {d} — 4+4 is too weak to split here.",
        )

    # 2,2 and 3,3: split vs 2–7.
    if rank in {Rank.TWO, Rank.THREE}:
        if 2 <= dealer <= 7:
            label = "2s" if rank == Rank.TWO else "3s"
            return StrategyAdvice(
                StrategyAction.SPLIT,
                f"Split {label} vs dealer {d} — dealer bust zone; improve weak total.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit vs dealer {d} — dealer upcard too strong for splitting.",
        )

    # 5,5: never split — play as hard 10 (handled by caller).
    return StrategyAdvice(
        StrategyAction.HIT,
        "Treat 5+5 as hard 10.",
    )


# ------------------------------------------------------------------
# Soft totals (Ace as 11)
# ------------------------------------------------------------------


def _soft_strategy(total: int, dealer: int) -> StrategyAdvice:
    d = _up(dealer)

    # A,9 (20) and A,8+ (19+): stand — already strong.
    if total >= 19:
        return StrategyAdvice(
            StrategyAction.STAND,
            f"Stand soft {total} vs dealer {d} — pat hand.",
        )

    # A,7 (soft 18): most nuanced soft hand.
    if total == 18:
        if dealer in {9, 10, 11}:
            return StrategyAdvice(
                StrategyAction.HIT,
                f"Hit soft 18 vs dealer {d} — 18 loses often vs strong upcard.",
            )
        if 3 <= dealer <= 6:
            return StrategyAdvice(
                StrategyAction.DOUBLE,
                f"Double soft 18 vs dealer {d} — dealer bust zone; one card to 19–21.",
            )
        return StrategyAdvice(
            StrategyAction.STAND,
            f"Stand soft 18 vs dealer {d} — good enough vs weak/mid upcard.",
        )

    # A,6 (soft 17): double vs 3–6.
    if total == 17:
        if 3 <= dealer <= 6:
            return StrategyAdvice(
                StrategyAction.DOUBLE,
                f"Double soft 17 vs dealer {d} — one card can make strong 18–21.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit soft 17 vs dealer {d} — too weak to stand, can't double.",
        )

    # A,4–A,5 (soft 15–16): double vs 4–6.
    if total in {15, 16}:
        if 4 <= dealer <= 6:
            return StrategyAdvice(
                StrategyAction.DOUBLE,
                f"Double soft {total} vs dealer {d} — dealer likely busts.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit soft {total} vs dealer {d} — need improvement.",
        )

    # A,2–A,3 (soft 13–14): double vs 5–6.
    if total in {13, 14}:
        if dealer in {5, 6}:
            return StrategyAdvice(
                StrategyAction.DOUBLE,
                f"Double soft {total} vs dealer {d} — dealer very weak.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit soft {total} vs dealer {d} — build the hand.",
        )

    return StrategyAdvice(StrategyAction.HIT, f"Hit soft {total} — very low total.")


# ------------------------------------------------------------------
# Hard totals
# ------------------------------------------------------------------


def _hard_strategy(total: int, dealer: int) -> StrategyAdvice:
    d = _up(dealer)

    if total >= 17:
        return StrategyAdvice(
            StrategyAction.STAND,
            f"Stand on {total} vs dealer {d} — bust risk too high if you hit.",
        )

    if total in {13, 14, 15, 16}:
        if 2 <= dealer <= 6:
            return StrategyAdvice(
                StrategyAction.STAND,
                f"Stand on {total} vs dealer {d} — dealer bust zone; you win if they bust.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit {total} vs dealer {d} — dealer likely makes a hand; you must improve.",
        )

    if total == 12:
        if 4 <= dealer <= 6:
            return StrategyAdvice(
                StrategyAction.STAND,
                f"Stand on 12 vs dealer {d} — dealer weak; let them bust.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit 12 vs dealer {d} — 12 loses to dealer 7+ too often.",
        )

    if total == 11:
        if dealer == 11:
            return StrategyAdvice(
                StrategyAction.HIT,
                f"Hit 11 vs Ace — Ace is too strong to double into.",
            )
        return StrategyAdvice(
            StrategyAction.DOUBLE,
            f"Double 11 vs dealer {d} — best doubling hand; one card to 12–21.",
        )

    if total == 10:
        if 2 <= dealer <= 9:
            return StrategyAdvice(
                StrategyAction.DOUBLE,
                f"Double 10 vs dealer {d} — strong chance to land 20.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit 10 vs dealer {d} — dealer 10/A too strong to double.",
        )

    if total == 9:
        if 3 <= dealer <= 6:
            return StrategyAdvice(
                StrategyAction.DOUBLE,
                f"Double 9 vs dealer {d} — dealer bust zone.",
            )
        return StrategyAdvice(
            StrategyAction.HIT,
            f"Hit 9 vs dealer {d} — need a 10-value card.",
        )

    # 8 or less: always hit.
    return StrategyAdvice(
        StrategyAction.HIT,
        f"Hit {total} vs dealer {d} — can't stand on such a low total.",
    )


def print_basic_strategy_chart() -> None:
    """Reference chart the player can request mid-game."""
    print()
    print("=" * 60)
    print("  BASIC STRATEGY QUICK REFERENCE (6–8 deck, dealer hits soft 17)")
    print("=" * 60)
    print()
    print("HARD TOTALS (dealer upcard → action)")
    print("  8 or less     : Hit always")
    print("  9             : Double vs 3–6, else Hit")
    print("  10            : Double vs 2–9, else Hit")
    print("  11            : Double vs 2–10, Hit vs Ace")
    print("  12            : Stand vs 4–6, else Hit")
    print("  13–16         : Stand vs 2–6, else Hit")
    print("  17+           : Stand always")
    print()
    print("SOFT TOTALS")
    print("  A,2 – A,3     : Double vs 5–6, else Hit")
    print("  A,4 – A,5     : Double vs 4–6, else Hit")
    print("  A,6           : Double vs 3–6, else Hit")
    print("  A,7           : Stand vs 2,7,8 | Double vs 3–6 | Hit vs 9,10,A")
    print("  A,8+          : Stand always")
    print()
    print("PAIRS")
    print("  A,A / 8,8     : Split always")
    print("  2,2 / 3,3     : Split vs 2–7, else Hit")
    print("  4,4           : Split vs 5–6, else Hit")
    print("  5,5           : Never split — treat as 10 (double vs 2–9)")
    print("  6,6           : Split vs 2–6, else Hit")
    print("  7,7           : Split vs 2–7, else Hit")
    print("  9,9           : Split vs 2–6,8,9 | Stand vs 7,10,A")
    print("  10,10         : Stand always")
    print()
    print("D = Double if allowed (else Hit).  P = Split if allowed (else Hit).")
    print("=" * 60)
    print()