"""
Progressive help system — the heart of CountQuest.

``HelpSystem`` is the single gate for what the player sees at each training
level. Game code asks permission before showing counts, strategy, bets, or
coaching feedback.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from countquest.betting import BetSuggestion
from countquest.counter import CountInfo
from countquest.models import HelpLevel
from countquest.strategy import StrategyAction, StrategyAdvice


@dataclass
class DecisionRecord:
    """One player choice vs basic strategy — used for post-hand review."""

    player_action: str
    optimal_action: StrategyAction
    rationale: str
    was_mistake: bool
    was_close: bool


@dataclass
class RoundReview:
    """Coaching payload generated at end of a hand (Level 0+)."""

    running_at_start: int
    running_at_end: int
    true_at_end: float
    decisions: list[DecisionRecord] = field(default_factory=list)
    bet_amount: int = 0
    suggested_bet: int = 0

    @property
    def count_delta(self) -> int:
        return self.running_at_end - self.running_at_start


@dataclass
class ShoeReview:
    """Aggregated stats for one shoe (Level 3 post-shoe report)."""

    shoe_number: int
    hands_played: int
    guesses: int = 0
    correct: int = 0
    mistakes: int = 0

    @property
    def accuracy_pct(self) -> float:
        if self.guesses == 0:
            return 0.0
        return 100.0 * self.correct / self.guesses


class HelpSystem:
    """
    Controls information visibility by ``HelpLevel``.

    Level summary:
      0 Novice    — everything visible + post-hand coaching
      1 Guided    — count quiz each round; bet range; strategy on errors
      2 Practice  — hidden count in play; post-hand count quiz; mistake hints
      3 Challenge — silent play; post-shoe report; strategy chart only
      4 Expert    — pure sim; session-end analytics only
    """

    def __init__(self, level: HelpLevel = HelpLevel.NOVICE) -> None:
        self.level = level
        self.current_shoe = ShoeReview(shoe_number=1, hands_played=0)
        self.session_mistakes: list[DecisionRecord] = []

    def set_level(self, level: HelpLevel) -> None:
        self.level = level

    # ------------------------------------------------------------------
    # During play — counts
    # ------------------------------------------------------------------

    def show_count_during_play(self) -> bool:
        return self.level <= HelpLevel.GUIDED

    def show_per_card_count_updates(self) -> bool:
        return self.level == HelpLevel.NOVICE

    def show_count_at_table(self) -> bool:
        return self.level <= HelpLevel.GUIDED

    def require_pre_round_count_confirm(self) -> bool:
        return self.level == HelpLevel.GUIDED

    def hide_count_completely_in_play(self) -> bool:
        return self.level >= HelpLevel.PRACTICE

    # ------------------------------------------------------------------
    # During play — betting
    # ------------------------------------------------------------------

    def show_bet_suggestion(self) -> bool:
        return self.level <= HelpLevel.GUIDED

    def show_exact_bet(self) -> bool:
        return self.level == HelpLevel.NOVICE

    def show_bet_range(self) -> bool:
        return self.level == HelpLevel.GUIDED

    # ------------------------------------------------------------------
    # During play — strategy
    # ------------------------------------------------------------------

    def show_strategy_always(self) -> bool:
        return self.level == HelpLevel.NOVICE

    def show_strategy_on_mistake_or_close(self) -> bool:
        return self.level in {HelpLevel.GUIDED, HelpLevel.PRACTICE}

    def show_strategy_only_on_request(self) -> bool:
        return self.level == HelpLevel.CHALLENGE

    def block_strategy_hints(self) -> bool:
        return self.level == HelpLevel.EXPERT

    def allow_strategy_chart(self) -> bool:
        return self.level <= HelpLevel.CHALLENGE

    # ------------------------------------------------------------------
    # Post-hand / post-shoe / post-session
    # ------------------------------------------------------------------

    def show_end_of_hand_count(self) -> bool:
        return self.level <= HelpLevel.PRACTICE

    def post_hand_count_quiz(self) -> bool:
        return self.level in {HelpLevel.PRACTICE, HelpLevel.CHALLENGE}

    def post_hand_count_quiz_optional(self) -> bool:
        return self.level == HelpLevel.NOVICE

    def post_hand_full_explanation(self) -> bool:
        return self.level == HelpLevel.NOVICE

    def show_session_stats_each_hand(self) -> bool:
        return self.level <= HelpLevel.CHALLENGE

    def post_shoe_summary(self) -> bool:
        return self.level == HelpLevel.CHALLENGE

    def post_session_analytics(self) -> bool:
        return True  # all levels get something; depth varies

    def expert_session_analytics_only(self) -> bool:
        return self.level == HelpLevel.EXPERT

    # ------------------------------------------------------------------
    # Decision analysis
    # ------------------------------------------------------------------

    @staticmethod
    def is_strategy_mistake(player_action: str, advice: StrategyAdvice) -> bool:
        return player_action != advice.action.value

    @staticmethod
    def is_close_decision(advice: StrategyAdvice, player_hand_total: int) -> bool:
        """
        Borderline spots where standing/hitting both look plausible to beginners.

        Used at Level 1 to show hints even if the player hasn't acted yet wrong.
        """
        borderline_hard = player_hand_total in {12, 13, 14, 15, 16}
        borderline_soft = player_hand_total in {17, 18}
        return borderline_hard or borderline_soft

    @staticmethod
    def is_clear_mistake_risk(advice: StrategyAdvice, hand_total: int) -> bool:
        """
        Level 2: warn only when the wrong play is a common costly error
        (standing on stiff hands, missing doubles/splits).
        """
        if advice.action in {
            StrategyAction.HIT,
            StrategyAction.DOUBLE,
            StrategyAction.SPLIT,
        }:
            return hand_total >= 9
        return False

    def should_show_strategy_hint(
        self,
        advice: StrategyAdvice,
        *,
        player_action: str | None = None,
        hand_total: int = 0,
        player_requested_chart: bool = False,
    ) -> bool:
        if self.block_strategy_hints():
            return False
        if self.show_strategy_always():
            return True
        if self.show_strategy_only_on_request():
            return player_requested_chart
        if self.level == HelpLevel.GUIDED:
            if player_action is not None:
                return self.is_strategy_mistake(player_action, advice)
            return self.is_close_decision(advice, hand_total)
        if self.level == HelpLevel.PRACTICE:
            if player_action is not None:
                return self.is_strategy_mistake(player_action, advice)
            return self.is_clear_mistake_risk(advice, hand_total)
        return False

    def record_decision(
        self,
        review: RoundReview,
        player_action: str,
        advice: StrategyAdvice,
        hand_total: int,
    ) -> None:
        mistake = self.is_strategy_mistake(player_action, advice)
        close = self.is_close_decision(advice, hand_total)
        record = DecisionRecord(
            player_action=player_action,
            optimal_action=advice.action,
            rationale=advice.rationale,
            was_mistake=mistake,
            was_close=close,
        )
        review.decisions.append(record)
        if mistake:
            self.session_mistakes.append(record)
            self.current_shoe.mistakes += 1

    # ------------------------------------------------------------------
    # Formatting helpers
    # ------------------------------------------------------------------

    @staticmethod
    def format_bet_range(
        suggestion: BetSuggestion,
        *,
        bankroll: int,
        min_bet: int,
    ) -> str:
        """Level 1: show a spread instead of one exact number."""
        low_units = max(1, suggestion.units - 1)
        high_units = min(6, suggestion.units + 1)
        cap = max(int(bankroll * 0.10), min_bet)
        low = max(min_bet, min(low_units * suggestion.unit_size, cap))
        high = max(low, min(high_units * suggestion.unit_size, cap, bankroll))
        tc_sign = "+" if suggestion.true_count >= 0 else ""
        return (
            f"True count {tc_sign}{suggestion.true_count:.1f} → "
            f"bet range ${low}–${high} "
            f"({low_units}–{high_units} units)"
        )

    def format_level_banner(self) -> str:
        descriptions = {
            HelpLevel.NOVICE: "Counts, strategy, and bet hints always on.",
            HelpLevel.GUIDED: "Confirm count each hand; bet range; hints on mistakes.",
            HelpLevel.PRACTICE: "Count hidden in play; quiz after each hand.",
            HelpLevel.CHALLENGE: "No in-play help; post-shoe report.",
            HelpLevel.EXPERT: "Pure simulation; analytics at session end only.",
        }
        return f"Help level: {self.level.label} — {descriptions[self.level]}"

    def explain_round(self, review: RoundReview) -> str:
        """Level 0 post-hand coaching paragraph."""
        lines = [
            "--- Hand review (Novice coaching) ---",
            f"Running count: {review.running_at_start:+d} → {review.running_at_end:+d} "
            f"(Δ {review.count_delta:+d})",
            f"True count now: {review.true_at_end:+.1f}",
        ]
        if review.bet_amount and review.suggested_bet:
            if review.bet_amount == review.suggested_bet:
                lines.append(f"Bet ${review.bet_amount} matched the count-based suggestion.")
            elif review.bet_amount > review.suggested_bet:
                lines.append(
                    f"Bet ${review.bet_amount} was above suggestion ${review.suggested_bet} "
                    f"(higher risk when count doesn't justify it)."
                )
            else:
                lines.append(
                    f"Bet ${review.bet_amount} was below suggestion ${review.suggested_bet} "
                    f"(leaving edge on the table at this count)."
                )
        for index, d in enumerate(review.decisions, 1):
            if d.was_mistake:
                lines.append(
                    f"Decision {index}: {d.player_action.upper()} was suboptimal — "
                    f"basic strategy says {d.optimal_action.value.upper()}. {d.rationale}"
                )
            else:
                lines.append(
                    f"Decision {index}: {d.player_action.upper()} matched basic strategy. Good."
                )
        return "\n".join(lines)

    def render_shoe_report(self, shoe: ShoeReview) -> str:
        """Level 3 text 'graph' of count accuracy across the shoe."""
        pct = shoe.accuracy_pct
        filled = int(pct / 10)
        bar = "█" * filled + "░" * (10 - filled)
        return (
            f"\n=== Shoe #{shoe.shoe_number} complete ===\n"
            f"Hands played: {shoe.hands_played}\n"
            f"Count guesses: {shoe.correct}/{shoe.guesses} ({pct:.0f}%)\n"
            f"Accuracy:  [{bar}] {pct:.0f}%\n"
            f"Strategy mistakes this shoe: {shoe.mistakes}\n"
        )

    def render_session_analytics(
        self,
        *,
        progress_accuracy: float,
        total_guesses: int,
        total_correct: int,
        mistakes: list[DecisionRecord],
        net_pl: int,
        hands: int,
    ) -> str:
        lines = ["\n=== Session analytics ==="]
        if self.expert_session_analytics_only():
            lines.append("Expert mode — full session breakdown:")
        lines.append(f"Hands played: {hands}")
        lines.append(f"Net profit/loss: {net_pl:+d}")
        if total_guesses:
            pct = 100.0 * total_correct / total_guesses
            filled = int(pct / 10)
            bar = "█" * filled + "░" * (10 - filled)
            lines.append(f"Count accuracy: {total_correct}/{total_guesses} ({pct:.0f}%)")
            lines.append(f"              [{bar}]")
            lines.append(
                f"EV note: accurate counting + correct bets yields ~0.5–1.5% edge "
                f"at high true counts; your accuracy determines how much of that you capture."
            )
        if mistakes:
            lines.append(f"Biggest strategy mistakes ({min(3, len(mistakes))} shown):")
            for m in mistakes[-3:]:
                lines.append(
                    f"  • Played {m.player_action.upper()} — should {m.optimal_action.value.upper()}"
                )
        else:
            lines.append("No strategy mistakes recorded this session.")
        return "\n".join(lines)

    def new_shoe(self) -> ShoeReview:
        finished = self.current_shoe
        self.current_shoe = ShoeReview(
            shoe_number=finished.shoe_number + 1,
            hands_played=0,
        )
        return finished

    def parse_level_command(self, raw: str) -> HelpLevel | None:
        """Parse 'level 2', 'help 3', 'help level 1' for testing."""
        text = raw.strip().lower()
        if text in {"help", "help level", "levels"}:
            return None  # signal to print levels
        for prefix in ("help level ", "help ", "level "):
            if text.startswith(prefix):
                try:
                    num = int(text[len(prefix) :].strip())
                    return HelpLevel(max(0, min(4, num)))
                except ValueError:
                    return None
        return None