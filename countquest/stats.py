"""
Player statistics, ranks, and automatic training progression.

``PlayerStats`` persists across sessions and drives:
  - Accuracy metrics (count + basic-strategy decisions)
  - Rough EV estimate (educational, not a simulator)
  - Rank titles (Novice → Master)
  - Auto help-level promotion when thresholds are met
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum

from countquest.models import HelpLevel


class PlayerRank(IntEnum):
    """Skill rank — separate from help level (training wheels)."""

    NOVICE = 0
    APPRENTICE = 1
    JOURNEYMAN = 2
    EXPERT = 3
    MASTER = 4

    @property
    def title(self) -> str:
        return self.name.capitalize()

    @property
    def unlock_blurb(self) -> str:
        return _RANK_UNLOCKS[self]


_RANK_UNLOCKS: dict[PlayerRank, str] = {
    PlayerRank.NOVICE: "Full coaching (Help Level 0). Learn counts and strategy.",
    PlayerRank.APPRENTICE: "Guided mode unlocked. Bet ranges and mistake hints.",
    PlayerRank.JOURNEYMAN: "Practice mode recommended — count hidden during play.",
    PlayerRank.EXPERT: "Challenge mode — post-shoe reports, minimal hints.",
    PlayerRank.MASTER: "Expert simulation. You earn session analytics only.",
}

# (rank, min_hands, min_count_%, min_decision_%)
_RANK_THRESHOLDS: list[tuple[PlayerRank, int, float, float]] = [
    (PlayerRank.NOVICE, 0, 0, 0),
    (PlayerRank.APPRENTICE, 25, 65.0, 70.0),
    (PlayerRank.JOURNEYMAN, 100, 75.0, 80.0),
    (PlayerRank.EXPERT, 250, 82.0, 85.0),
    (PlayerRank.MASTER, 500, 88.0, 90.0),
]

# Auto help-level promotion: 85%+ count accuracy over last 50 guesses.
_LEVEL_UP_COUNT_WINDOW = 50
_LEVEL_UP_COUNT_PCT = 85.0
_LEVEL_UP_DECISION_PCT = 80.0
_LEVEL_UP_MIN_GUESSES = 15
_LEVEL_UP_MIN_HANDS = 50


@dataclass
class PlayerStats:
    """
    Lifetime player statistics persisted to JSON.

    Help level (0–4) controls UI coaching; rank reflects demonstrated skill.
    """

    player_name: str = "Player"
    help_level: int = 0
    rank: int = 0

    hands_played: int = 0
    shoes_played: int = 0

    count_guesses: int = 0
    count_correct: int = 0
    recent_count_results: list[bool] = field(default_factory=list)

    decisions_total: int = 0
    decisions_correct: int = 0

    strategy_mistakes: int = 0
    bets_matched_suggestion: int = 0
    bets_total: int = 0

    total_net_profit_loss: int = 0
    best_bankroll: int = 0
    bankroll_history: list[int] = field(default_factory=list)

    last_level_up_hand: int = 0
    help_levelups: int = 0

    # ------------------------------------------------------------------
    # Help level
    # ------------------------------------------------------------------

    @property
    def help_level_enum(self) -> HelpLevel:
        return HelpLevel(max(0, min(4, self.help_level)))

    @property
    def rank_enum(self) -> PlayerRank:
        return PlayerRank(max(0, min(4, self.rank)))

    def set_help_level(self, level: HelpLevel) -> None:
        self.help_level = int(level)

    # ------------------------------------------------------------------
    # Recording events
    # ------------------------------------------------------------------

    def record_count_guess(self, correct: bool) -> None:
        self.count_guesses += 1
        if correct:
            self.count_correct += 1
        self.recent_count_results.append(correct)
        if len(self.recent_count_results) > 100:
            self.recent_count_results.pop(0)

    def record_decision(self, correct: bool) -> None:
        self.decisions_total += 1
        if correct:
            self.decisions_correct += 1
        if not correct:
            self.strategy_mistakes += 1

    def record_bet(self, matched_suggestion: bool) -> None:
        self.bets_total += 1
        if matched_suggestion:
            self.bets_matched_suggestion += 1

    def record_hand_end(
        self,
        bankroll: int,
        net_pl: int = 0,
    ) -> tuple[PlayerRank | None, HelpLevel | None]:
        """
        Update stats after a hand completes.

        Returns:
            ``(new_rank, new_help_level)`` if promoted this hand, else ``(None, None)``.
        """
        old_rank = self.rank_enum
        old_help = self.help_level_enum
        self.hands_played += 1
        self.total_net_profit_loss += net_pl
        self.bankroll_history.append(bankroll)
        if len(self.bankroll_history) > 200:
            self.bankroll_history.pop(0)
        self.best_bankroll = max(self.best_bankroll, bankroll)
        self._update_rank()
        self.try_auto_help_level_up()
        rank_promo = self.rank_enum if self.rank_enum != old_rank else None
        help_promo = self.help_level_enum if self.help_level_enum != old_help else None
        return rank_promo, help_promo

    def record_shoe_complete(self) -> None:
        self.shoes_played += 1

    # ------------------------------------------------------------------
    # Accuracy & EV
    # ------------------------------------------------------------------

    @property
    def count_accuracy_pct(self) -> float:
        if self.count_guesses == 0:
            return 0.0
        return 100.0 * self.count_correct / self.count_guesses

    @property
    def decision_accuracy_pct(self) -> float:
        if self.decisions_total == 0:
            return 0.0
        return 100.0 * self.decisions_correct / self.decisions_total

    @property
    def bet_alignment_pct(self) -> float:
        if self.bets_total == 0:
            return 0.0
        return 100.0 * self.bets_matched_suggestion / self.bets_total

    def recent_count_accuracy(self, window: int = _LEVEL_UP_COUNT_WINDOW) -> float:
        if not self.recent_count_results:
            return 0.0
        sample = self.recent_count_results[-window:]
        return 100.0 * sum(sample) / len(sample)

    def rough_ev_estimate_pct(self) -> float:
        """
        Very rough expected-value edge estimate for the learner.

        Baseline house edge ~-0.5%. Skilled counting + correct strategy can add
        ~0.5–1.5%. We blend decision skill, count skill, and bet alignment into
        one educational number — NOT a precise simulator.
        """
        if self.hands_played < 20:
            return -0.5

        count_factor = self.recent_count_accuracy(30) / 100.0 if self.count_guesses else 0.5
        decision_factor = self.decision_accuracy_pct / 100.0 if self.decisions_total else 0.5
        bet_factor = self.bet_alignment_pct / 100.0 if self.bets_total else 0.5

        skill = (count_factor * 0.4) + (decision_factor * 0.45) + (bet_factor * 0.15)
        return -0.5 + skill * 1.5

    # ------------------------------------------------------------------
    # Bankroll summary
    # ------------------------------------------------------------------

    def bankroll_min(self) -> int | None:
        return min(self.bankroll_history) if self.bankroll_history else None

    def bankroll_max(self) -> int | None:
        return max(self.bankroll_history) if self.bankroll_history else None

    def bankroll_average(self) -> float | None:
        if not self.bankroll_history:
            return None
        return sum(self.bankroll_history) / len(self.bankroll_history)

    # ------------------------------------------------------------------
    # Rank & auto level-up
    # ------------------------------------------------------------------

    def _update_rank(self) -> PlayerRank | None:
        """Promote rank when lifetime thresholds are met. Returns new rank if changed."""
        old = self.rank_enum
        new_rank = PlayerRank.NOVICE
        count_pct = self.count_accuracy_pct if self.count_guesses >= 10 else 0.0
        decision_pct = self.decision_accuracy_pct if self.decisions_total >= 20 else 0.0

        for rank, min_hands, min_count, min_dec in _RANK_THRESHOLDS:
            if self.hands_played >= min_hands:
                if self.count_guesses < 10 or count_pct >= min_count:
                    if self.decisions_total < 20 or decision_pct >= min_dec:
                        new_rank = rank

        if int(new_rank) > int(old):
            self.rank = int(new_rank)
            return new_rank
        return None

    def try_auto_help_level_up(self) -> HelpLevel | None:
        """
        Promote help level one step when recent accuracy is strong.

        Requires 50+ hands, 15+ recent count guesses, 85%+ recent count accuracy,
        and 80%+ lifetime decision accuracy. Won't exceed rank cap or level 4.
        """
        if self.hands_played < _LEVEL_UP_MIN_HANDS:
            return None
        if self.hands_played - self.last_level_up_hand < 25:
            return None
        if self.help_level >= 4:
            return None
        if len(self.recent_count_results) < _LEVEL_UP_MIN_GUESSES:
            return None
        if self.recent_count_accuracy(_LEVEL_UP_COUNT_WINDOW) < _LEVEL_UP_COUNT_PCT:
            return None
        if self.decision_accuracy_pct < _LEVEL_UP_DECISION_PCT:
            return None

        self.help_level += 1
        self.help_levelups += 1
        self.last_level_up_hand = self.hands_played
        return self.help_level_enum

    def recommended_help_for_rank(self) -> HelpLevel:
        """Suggested training tier for current rank."""
        return HelpLevel(min(int(self.rank_enum), 4))

    # ------------------------------------------------------------------
    # Display
    # ------------------------------------------------------------------

    def format_stats(self, *, current_bankroll: int | None = None) -> str:
        lines = [
            "=" * 56,
            f"  PLAYER STATS — {self.player_name}",
            "=" * 56,
            f"Rank: {self.rank_enum.title}  |  Help level: {self.help_level}  |  "
            f"Hands: {self.hands_played}  |  Shoes: {self.shoes_played}",
            "",
            f"Count accuracy:     {self.count_accuracy_pct:5.1f}%  "
            f"({self.count_correct}/{self.count_guesses} guesses)",
            f"Decision accuracy:  {self.decision_accuracy_pct:5.1f}%  "
            f"({self.decisions_correct}/{self.decisions_total} decisions)",
            f"Bet alignment:      {self.bet_alignment_pct:5.1f}%  "
            f"(matched count-based suggestion)",
            f"Recent count (50):  {self.recent_count_accuracy():5.1f}%",
            f"Rough EV estimate:  {self.rough_ev_estimate_pct:+.2f}% per hand",
            "",
        ]

        if self.bankroll_history:
            avg = self.bankroll_average()
            lines.append(
                f"Bankroll — min ${self.bankroll_min()}  |  max ${self.bankroll_max()}  |  "
                f"avg ${avg:.0f}  |  best ever ${self.best_bankroll}"
            )
            tail = self.bankroll_history[-8:]
            lines.append(f"Recent bankroll: {' → '.join(str(b) for b in tail)}")
        if current_bankroll is not None:
            lines.append(f"Current bankroll: ${current_bankroll}")

        lines.extend(["", "— Rank ladder —"])
        for rank in PlayerRank:
            marker = "▶" if rank == self.rank_enum else " "
            lines.append(f"  {marker} {rank.title}: {rank.unlock_blurb}")

        if self.help_levelups:
            lines.append(f"\nAuto help promotions: {self.help_levelups}")
        lines.append("=" * 56)
        return "\n".join(lines)