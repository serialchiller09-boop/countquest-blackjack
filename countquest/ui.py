"""
Console input/output — keeps game rules separate from printing and prompts.
"""

from __future__ import annotations

from dataclasses import dataclass

from countquest.betting import BetSuggestion
from countquest.card import Card
from countquest.counter import CountInfo
from countquest.hand import Hand
from countquest.models import HelpLevel, Suit
from countquest.strategy import StrategyAdvice, print_basic_strategy_chart
from countquest.terminal import Ansi, clear_screen, paint, supports_color


@dataclass
class ConsoleUI:
    """Text interface for CountQuest Blackjack with optional ANSI styling."""

    use_color: bool = True
    clear_screen: bool = True
    practice_mode: bool = False

    def __post_init__(self) -> None:
        if self.use_color and not supports_color():
            self.use_color = False

    def clear(self) -> None:
        if self.clear_screen:
            clear_screen()

    def _c(self, text: str, *codes: str) -> str:
        return paint(text, *codes, use_color=self.use_color)

    def banner(self, *, compact: bool = False) -> None:
        title = self._c("CountQuest Blackjack", Ansi.BOLD, Ansi.CYAN)
        if compact:
            print(f"\n{title}")
            return
        print()
        print(self._c("═" * 52, Ansi.CYAN))
        print(f"  {title}")
        mode = self._c("Practice Mode ∞", Ansi.YELLOW) if self.practice_mode else ""
        if mode:
            print(f"  {mode}")
        print(self._c("═" * 52, Ansi.CYAN))

    def format_card(self, card: Card) -> str:
        text = card.display()
        if card.suit in {Suit.HEARTS, Suit.DIAMONDS}:
            return self._c(text, Ansi.RED, Ansi.BOLD)
        return self._c(text, Ansi.WHITE, Ansi.BOLD)

    def format_cards(self, hand: Hand, *, hide_hole: bool = False) -> str:
        if not hand.cards:
            return self._c("(empty)", Ansi.DIM)
        parts: list[str] = []
        for index, card in enumerate(hand.cards):
            if hide_hole and index == 1:
                parts.append(self._c("▐██▌", Ansi.BLUE, Ansi.BOLD))
            else:
                parts.append(self.format_card(card))
        return "  ".join(parts)

    def show_bankroll(self, bankroll: int, min_bet: int) -> None:
        if self.practice_mode:
            label = self._c("Bankroll: ∞ Practice chips", Ansi.YELLOW, Ansi.BOLD)
            print(f"\n{label}  {self._c(f'(min bet ${min_bet})', Ansi.DIM)}")
            print(self._c(f"  (tracking ${bankroll:,} for bet sizing)", Ansi.DIM))
        else:
            color = Ansi.GREEN if bankroll >= min_bet * 5 else Ansi.YELLOW
            print(
                f"\n{self._c('Bankroll:', Ansi.BOLD)} "
                f"{self._c(f'${bankroll:,}', color, Ansi.BOLD)}  "
                f"{self._c(f'(min bet ${min_bet})', Ansi.DIM)}"
            )

    def show_betting_advice(
        self,
        count_info: CountInfo,
        suggestion: BetSuggestion,
        *,
        exact: bool = True,
        range_text: str | None = None,
    ) -> None:
        header = self._c("[Bet]", Ansi.MAGENTA, Ansi.BOLD)
        if exact:
            tc_sign = "+" if count_info.true_count >= 0 else ""
            tc = self._c(
                f"{tc_sign}{count_info.true_count:.1f}",
                Ansi.CYAN,
                Ansi.BOLD,
            )
            print(
                f"\n{header} True count {tc}  |  "
                f"{self._c(suggestion.formatted(), Ansi.GREEN)}"
            )
        elif range_text:
            print(f"\n{header} {range_text}")

    def show_help_level(self, text: str) -> None:
        print(f"\n{self._c('[Help]', Ansi.BLUE, Ansi.BOLD)} {text}")

    def show_help_level_menu(self) -> None:
        print(f"\n{self._c('Help levels', Ansi.BLUE, Ansi.BOLD)} (type 'level N' to switch):")
        for level in HelpLevel:
            print(f"  {int(level)} — {level.label}")

    def prompt_count_confirm(self, actual: int, tolerance: int = 1) -> bool:
        guess = self.prompt_count_guess_required()
        if guess is None:
            return False
        return abs(guess - actual) <= tolerance

    def prompt_count_guess_required(self) -> int | None:
        raw = input(
            self._c("\nWhat is the running count right now? ", Ansi.CYAN)
        ).strip()
        try:
            return int(raw)
        except ValueError:
            print(self._c("  Enter an integer.", Ansi.YELLOW))
            return None

    def show_round_review(self, text: str) -> None:
        print(f"\n{self._c(text, Ansi.DIM)}")

    def show_session_stats(self, summary: str) -> None:
        print(f"\n{self._c('[Stats]', Ansi.BLUE)} {summary}")

    def show_player_stats(self, report: str) -> None:
        print(report)

    def show_shoe_status(self, message: str) -> None:
        print(f"\n{self._c('[Shoe]', Ansi.MAGENTA)} {message}")

    def prompt_bet(
        self,
        bankroll: int,
        min_bet: int,
        suggestion: BetSuggestion,
    ) -> int | None:
        suggested = suggestion.amount
        while True:
            raw = input(
                f"Place bet (${min_bet}-${bankroll:,}, "
                f"Enter=${suggested}, q=quit): "
            ).strip().lower()

            if raw in {"q", "quit", "exit"}:
                return None
            if raw in {"help", "help level", "levels"}:
                self.show_help_level_menu()
                continue

            if raw == "":
                amount = suggested
            else:
                try:
                    amount = int(raw)
                except ValueError:
                    print(self._c("  Please enter a whole number.", Ansi.YELLOW))
                    continue

            if amount < min_bet:
                print(self._c(f"  Minimum bet is ${min_bet}.", Ansi.YELLOW))
                continue
            if amount > bankroll:
                print(self._c(f"  You only have ${bankroll:,}.", Ansi.YELLOW))
                continue
            return amount

    def prompt_insurance(self, max_bet: int, bankroll: int) -> int:
        print(
            f"\n{self._c('[Insurance]', Ansi.YELLOW, Ansi.BOLD)} "
            f"Dealer shows Ace. Max insurance: ${max_bet}"
        )
        while True:
            raw = input("Take insurance? [y/N] or enter amount: ").strip().lower()
            if raw in {"", "n", "no"}:
                return 0
            if raw in {"y", "yes"}:
                return min(max_bet, bankroll)
            try:
                amount = int(raw)
            except ValueError:
                print(self._c("  Enter y, n, or a dollar amount.", Ansi.YELLOW))
                continue
            if amount <= 0:
                return 0
            if amount > max_bet:
                print(self._c(f"  Max insurance is ${max_bet}.", Ansi.YELLOW))
                continue
            if amount > bankroll:
                print(self._c(f"  You only have ${bankroll:,}.", Ansi.YELLOW))
                continue
            return amount

    def show_table(
        self,
        player_label: str,
        player_hand: Hand,
        dealer_hand: Hand,
        *,
        hide_dealer_hole: bool,
    ) -> None:
        border = self._c("─" * 44, Ansi.DIM)
        print()
        print(border)
        dealer_cards = self.format_cards(dealer_hand, hide_hole=hide_dealer_hole)
        print(f"  {self._c('Dealer:', Ansi.BOLD)} {dealer_cards}")
        if hide_dealer_hole and dealer_hand.size >= 2:
            print(f"           {dealer_hand.summary(hide_hole=True)}")
        else:
            print(f"           {self._c(dealer_hand.summary(), Ansi.DIM)}")
        print(border)
        player_cards = self.format_cards(player_hand)
        label = self._c(f"{player_label}:", Ansi.BOLD, Ansi.GREEN)
        print(f"  {label} {player_cards}")
        print(f"           {self._c(player_hand.summary(), Ansi.DIM)}")
        print(border)

    def show_strategy_advice(self, advice: StrategyAdvice) -> None:
        print(
            f"{self._c('[Strategy]', Ansi.BLUE, Ansi.BOLD)} "
            f"{self._c(advice.formatted(), Ansi.CYAN)}"
        )

    def show_basic_strategy_chart(self) -> None:
        print_basic_strategy_chart()

    def show_count(
        self,
        info: CountInfo,
        *,
        card_note: str | None = None,
        hole_hidden: bool = False,
    ) -> None:
        line = (
            f"{self._c('[Count]', Ansi.CYAN, Ansi.BOLD)} "
            f"{self._c(info.formatted(), Ansi.BOLD)}"
        )
        if card_note:
            line += f"  {self._c('← ' + card_note, Ansi.DIM)}"
        print(line)
        if hole_hidden:
            print(
                self._c(
                    "        (count includes unseen hole/burn cards dealt from shoe)",
                    Ansi.DIM,
                )
            )

    def prompt_action(
        self,
        *,
        can_double: bool,
        can_split: bool,
    ) -> str:
        options = ["H]it", "S]tand"]
        if can_double:
            options.append("D]ouble")
        if can_split:
            options.append("P]plit")

        hint = "  ".join(options)
        hint += "  |  type 'strategy' for chart"
        valid = {
            "h": "hit",
            "hit": "hit",
            "s": "stand",
            "stand": "stand",
            "d": "double",
            "double": "double",
            "p": "split",
            "split": "split",
        }
        chart_commands = {
            "strategy",
            "show basic strategy",
            "show strategy",
            "chart",
        }

        while True:
            raw = input(f"Your move ({hint}): ").strip().lower()
            if raw in {"help", "help level", "levels"}:
                self.show_help_level_menu()
                continue
            if raw in chart_commands:
                self.show_basic_strategy_chart()
                continue
            action = valid.get(raw)
            if action is None:
                print(self._c("  Invalid choice. Try again.", Ansi.YELLOW))
                continue
            if action == "double" and not can_double:
                print(self._c("  Double is not available right now.", Ansi.YELLOW))
                continue
            if action == "split" and not can_split:
                print(self._c("  Split is not available right now.", Ansi.YELLOW))
                continue
            return action

    def show_result(self, label: str, result: str, net: int, bet: int) -> None:
        sign = "+" if net >= 0 else ""
        upper = result.upper()
        if upper in {"WIN", "BLACKJACK"}:
            color = Ansi.GREEN
        elif upper == "PUSH":
            color = Ansi.YELLOW
        else:
            color = Ansi.RED
        text = f"  {label}: {self._c(upper, color, Ansi.BOLD)}  (bet ${bet}, net {sign}${net})"
        print(text)

    def show_message(self, message: str) -> None:
        print(f"\n{message}")

    def confirm_continue(self) -> bool:
        raw = input(
            self._c("\nPlay another hand? [Y/n]: ", Ansi.CYAN)
        ).strip().lower()
        return raw in {"", "y", "yes"}

    def confirm_reset(self) -> bool:
        print(
            self._c(
                "\n⚠  This deletes ALL saved progress (stats, rank, settings).",
                Ansi.YELLOW,
                Ansi.BOLD,
            )
        )
        raw = input("Type RESET to confirm, or anything else to cancel: ").strip()
        return raw == "RESET"

    def prompt_count_guess(self) -> int | None:
        raw = input(
            "\nGuess the running count (±1 counts as correct, Enter to skip): "
        ).strip()
        if raw == "":
            return None

        try:
            return int(raw)
        except ValueError:
            print(self._c("  Not a number — skipped.", Ansi.YELLOW))
            return None

    def show_count_guess_result(
        self,
        guess: int,
        actual_running: int,
        *,
        correct: bool,
        tolerance: int,
    ) -> None:
        if correct:
            print(
                self._c(
                    f"  ✓ Correct! Actual running count: {actual_running:+d}",
                    Ansi.GREEN,
                    Ansi.BOLD,
                )
            )
        else:
            diff = abs(guess - actual_running)
            print(
                self._c(
                    f"  ✗ Off by {diff}. Actual running count: {actual_running:+d} "
                    f"(your guess: {guess:+d}, tolerance ±{tolerance})",
                    Ansi.RED,
                )
            )