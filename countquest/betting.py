"""
Count-based bet sizing and session wagering statistics.

Bet spread (linear ramp by true count):
  TC ≤ 0  → 1 unit  (minimum — neutral or unfavorable shoe)
  TC +1   → 2 units
  TC +2   → 3 units
  ...
  TC +5+  → 6 units  (capped — never suggest more than 6× base unit)

**Risk of ruin awareness:**
  Card counting gives a small edge (often ~0.5–1.5% at high true counts), not
  a guarantee. Betting too large relative to bankroll — even with an edge —
  creates wild swings that can wipe you out (*gambler's ruin*) before the
  advantage materializes. Professional counters commonly keep any single wager
  well under 1–2% of bankroll; we cap suggestions at 10% as a hard safety rail
  for this trainer, not as recommended live-play practice.
"""

from __future__ import annotations

from dataclasses import dataclass

# Spread caps — tunable later per help level / progression.
_MAX_SPREAD_UNITS = 6
_MAX_TC_FOR_RAMP = 5
_MIN_UNITS = 1
_BANKROLL_BET_CAP_FRACTION = 0.10


@dataclass(frozen=True, slots=True)
class BetSuggestion:
    """Recommended wager from true count and bankroll safety caps."""

    true_count: float
    units: int
    unit_size: int
    amount: int
    capped_by_bankroll: bool

    def formatted(self) -> str:
        tc_sign = "+" if self.true_count >= 0 else ""
        cap = " (bankroll cap applied)" if self.capped_by_bankroll else ""
        return (
            f"True count {tc_sign}{self.true_count:.1f} → "
            f"{self.units} unit(s) × ${self.unit_size} = "
            f"${self.amount} suggested{cap}"
        )


@dataclass
class SessionStats:
    """Tracks lifetime wagering and profit for the current session."""

    starting_bankroll: int
    total_wagered: int = 0
    net_profit_loss: int = 0
    hands_played: int = 0
    insurance_taken: int = 0
    insurance_won: int = 0

    def record_wager(self, amount: int) -> None:
        if amount > 0:
            self.total_wagered += amount

    def record_result(self, net: int) -> None:
        self.net_profit_loss += net
        self.hands_played += 1

    def summary(self, current_bankroll: int) -> str:
        sign = "+" if self.net_profit_loss >= 0 else ""
        return (
            f"Session: {self.hands_played} hands  |  "
            f"Wagered: ${self.total_wagered}  |  "
            f"Net P/L: {sign}${self.net_profit_loss}  |  "
            f"Bankroll: ${current_bankroll} "
            f"(started ${self.starting_bankroll})"
        )


def true_count_units(true_count: float) -> int:
    """
    Map true count to a unit multiplier (1–6).

    Uses the floor of the true count for positive values so TC +1.8 → 2 units.
    Negative counts stay at the table minimum (1 unit).
    """
    if true_count <= 0:
        return _MIN_UNITS
    ramp = int(true_count)  # floor toward zero for positives
    ramp = min(ramp, _MAX_TC_FOR_RAMP)
    return _MIN_UNITS + ramp


def suggest_bet(
    true_count: float,
    *,
    bankroll: int,
    unit_size: int,
    min_bet: int,
) -> BetSuggestion:
    """
    Compute a suggested wager from true count with safety caps.

    Caps applied in order:
      1. Spread table (max 6 units)
      2. 10% of bankroll (risk-of-ruin guardrail)
      3. Minimum table bet
    """
    units = true_count_units(true_count)
    raw_amount = units * unit_size
    bankroll_cap = max(int(bankroll * _BANKROLL_BET_CAP_FRACTION), min_bet)
    capped = raw_amount > bankroll_cap
    amount = min(raw_amount, bankroll_cap, bankroll)
    amount = max(amount, min_bet)

    # Recompute effective units after cap for display honesty.
    effective_units = max(1, amount // unit_size) if unit_size else 1

    return BetSuggestion(
        true_count=true_count,
        units=effective_units,
        unit_size=unit_size,
        amount=amount,
        capped_by_bankroll=capped,
    )


def insurance_payout(insurance_bet: int, dealer_has_blackjack: bool) -> int:
    """
    Net profit/loss on an insurance side bet.

    Insurance pays 2:1 — bet $10, win $20 profit ($30 returned total).
    Returns net change (profit positive, loss negative).
    """
    if insurance_bet <= 0:
        return 0
    if dealer_has_blackjack:
        return insurance_bet * 2
    return -insurance_bet


def max_insurance_bet(main_bet: int) -> int:
    """Standard half-of-main-bet insurance (integer dollars)."""
    return main_bet // 2