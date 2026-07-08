"""
Blackjack round orchestration and session loop.

One ``Game`` instance owns the shoe, bankroll, counter, and UI for a session.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from countquest.betting import (
    SessionStats,
    insurance_payout,
    max_insurance_bet,
    suggest_bet,
)
from countquest.card import Card
from countquest.counter import CountAccuracyTracker, CountInfo, HiLoCounter
from countquest.deck import Shoe
from countquest.hand import Hand, HandResult, calculate_payout, compare_hands
from countquest.help_system import HelpSystem, RoundReview
from countquest.models import HelpLevel, Rank
from countquest.progression import ProgressionManager
from countquest.save_data import PRACTICE_BANKROLL, GameSettings, SaveData
from countquest.stats import PlayerStats
from countquest.strategy import BasicStrategy
from countquest.ui import ConsoleUI


@dataclass
class PlayerHandState:
    """One playable player hand (supports split — up to two hands)."""

    hand: Hand
    bet: int
    finished: bool = False
    doubled: bool = False
    is_from_split: bool = False
    split_aces: bool = False


@dataclass
class Game:
    """
    Full console blackjack session.

    Standard rules implemented here:
      - Dealer hits soft 17
      - Blackjack pays 3:2
      - Double on first two cards only
      - One split per round (matching ranks)
      - Split aces receive one card each and auto-stand
    """

    bankroll: int = 1000
    min_bet: int = 10
    unit_size: int = 10
    num_decks: int = 6
    practice_mode: bool = False
    ui: ConsoleUI = field(default_factory=ConsoleUI)
    shoe: Shoe = field(init=False)
    counter: HiLoCounter = field(default_factory=HiLoCounter)
    accuracy: CountAccuracyTracker = field(default_factory=CountAccuracyTracker)
    session: SessionStats = field(init=False)
    help: HelpSystem = field(default_factory=HelpSystem)
    stats: PlayerStats = field(default_factory=PlayerStats)
    progression: ProgressionManager = field(default_factory=ProgressionManager)
    dealer: Hand = field(default_factory=Hand)
    _save_data: SaveData | None = field(default=None, repr=False)
    _round_review: RoundReview | None = field(default=None, repr=False)
    _hand_net_pl: int = field(default=0, repr=False)

    def __post_init__(self) -> None:
        if self._save_data is None:
            self._save_data = self.progression.load_save()
            self.stats = self._save_data.stats
        self.shoe = Shoe(num_decks=self.num_decks)
        self.session = SessionStats(starting_bankroll=self.bankroll)
        self.help = HelpSystem(self.stats.help_level_enum)
        self._bootstrap_counter_from_shoe(verbose=False)

    # ------------------------------------------------------------------
    # Factory helpers
    # ------------------------------------------------------------------

    @classmethod
    def from_save(cls, save: SaveData, progression: ProgressionManager) -> Game:
        """Resume an interrupted session from disk."""
        settings = save.settings
        ui = ConsoleUI(
            use_color=settings.use_color,
            clear_screen=settings.clear_screen,
            practice_mode=settings.practice_mode,
        )
        return cls(
            bankroll=save.bankroll,
            min_bet=settings.min_bet,
            unit_size=settings.unit_size,
            num_decks=settings.num_decks,
            practice_mode=settings.practice_mode,
            ui=ui,
            stats=save.stats,
            progression=progression,
            _save_data=save,
        )

    @classmethod
    def new_session(
        cls,
        *,
        practice: bool,
        progression: ProgressionManager,
    ) -> Game:
        """Start a fresh table session (stats carry over from save)."""
        save = progression.load_save()
        settings = save.settings
        settings.practice_mode = practice
        settings.clear_screen = True
        settings.use_color = True

        if practice:
            bankroll = PRACTICE_BANKROLL
        else:
            bankroll = settings.starting_bankroll

        save.mark_session_start(bankroll)
        save.settings = settings
        progression.save_save(save)

        ui = ConsoleUI(
            use_color=settings.use_color,
            clear_screen=settings.clear_screen,
            practice_mode=practice,
        )
        return cls(
            bankroll=bankroll,
            min_bet=settings.min_bet,
            unit_size=settings.unit_size,
            num_decks=settings.num_decks,
            practice_mode=practice,
            ui=ui,
            stats=save.stats,
            progression=progression,
            _save_data=save,
        )

    # ------------------------------------------------------------------
    # Session loop
    # ------------------------------------------------------------------

    def run(self) -> None:
        """Play until the player quits or goes broke (full game only)."""
        if self._save_data and not self._save_data.session_active:
            self._save_data.mark_session_start(self.bankroll)
            self._persist()

        self.ui.clear()
        self.ui.banner()
        self.ui.show_help_level(self.help.format_level_banner())
        self._show_intro_messages()

        while self._can_play():
            if not self._play_round():
                break

        self._end_session()

    def _show_intro_messages(self) -> None:
        cmds = (
            "Commands: Hit/Stand/Double/Split | 'strategy' = chart | "
            "'stats' = view progress | 'level N' = help tier (0–4) | "
            "'reset' = wipe save | q = quit"
        )
        self.ui.show_message(cmds)
        self.ui.show_message(
            f"Rank: {self.stats.rank_enum.title} — {self.stats.rank_enum.unlock_blurb}"
        )
        if self.practice_mode:
            self.ui.show_message(
                "Practice Mode: infinite chips — focus on counting and basic strategy."
            )
        if self.help.show_count_during_play() and self.shoe.burned_cards:
            burned = self.shoe.burned_cards[0]
            self.ui.show_count(
                self.get_count_info(),
                card_note=f"session start burn {burned.display()}",
            )

    def _can_play(self) -> bool:
        if self.practice_mode:
            return True
        return self.bankroll >= self.min_bet

    def _ensure_practice_bankroll(self) -> None:
        if self.practice_mode and self.bankroll < self.min_bet:
            self.bankroll = PRACTICE_BANKROLL
            self.ui.show_message(
                "Practice chips refilled — keep counting!"
            )

    def _end_session(self) -> None:
        if self.practice_mode:
            self.ui.show_message(
                f"Session over. Practice bankroll: ${self.bankroll:,}"
            )
        elif self.bankroll < self.min_bet:
            self.ui.show_message(f"Out of chips! Final bankroll: ${self.bankroll:,}")
        else:
            self.ui.show_message(
                f"Thanks for playing. Final bankroll: ${self.bankroll:,}"
            )

        if self.help.post_session_analytics():
            report = self.help.render_session_analytics(
                progress_accuracy=self.stats.count_accuracy_pct,
                total_guesses=self.stats.count_guesses,
                total_correct=self.stats.count_correct,
                mistakes=self.help.session_mistakes,
                net_pl=self.session.net_profit_loss,
                hands=self.session.hands_played,
            )
            self.ui.show_message(report)

        if not self.help.expert_session_analytics_only():
            self.ui.show_session_stats(self.session.summary(self.bankroll))
            self.ui.show_message(self.accuracy.summary())

        self.stats.best_bankroll = max(self.stats.best_bankroll, self.bankroll)
        if self._save_data:
            self._save_data.mark_session_end()
        self._persist()

    def _persist(self) -> None:
        if self._save_data is None:
            return
        self._save_data.stats = self.stats
        self._save_data.bankroll = self.bankroll
        self._save_data.settings.practice_mode = self.practice_mode
        self._save_data.settings.use_color = self.ui.use_color
        self._save_data.settings.clear_screen = self.ui.clear_screen
        self._save_data.settings.num_decks = self.num_decks
        self._save_data.settings.min_bet = self.min_bet
        self._save_data.settings.unit_size = self.unit_size
        if not self.practice_mode:
            self._save_data.settings.starting_bankroll = self.session.starting_bankroll
        self._save_data.update_session(
            hands=self.session.hands_played,
            net_pl=self.session.net_profit_loss,
            bankroll=self.bankroll,
        )
        self.progression.save_save(self._save_data)

    def _play_round(self) -> bool:
        """Play one betting round. Returns False if the player chose to quit."""
        self.ui.clear()
        self.ui.banner(compact=True)
        self._ensure_practice_bankroll()

        self._ensure_shoe_ready()
        self.dealer.clear()

        self._hand_net_pl = 0
        self._round_review = RoundReview(
            running_at_start=self.counter.running_count,
            running_at_end=self.counter.running_count,
            true_at_end=self.get_count_info().true_count,
        )

        self.ui.show_bankroll(self.bankroll, self.min_bet)
        count_info = self.get_count_info()
        suggestion = suggest_bet(
            count_info.true_count,
            bankroll=self.bankroll,
            unit_size=self.unit_size,
            min_bet=self.min_bet,
        )

        if self.help.require_pre_round_count_confirm():
            ok = self.ui.prompt_count_confirm(
                self.counter.running_count,
                tolerance=self.accuracy.tolerance,
            )
            if ok:
                print("  Count confirmed.")
            else:
                print(
                    f"  Count is actually {self.counter.running_count:+d} "
                    f"(true {count_info.true_count:+.1f})."
                )

        if self.help.show_bet_suggestion():
            if self.help.show_exact_bet():
                self.ui.show_betting_advice(count_info, suggestion, exact=True)
            elif self.help.show_bet_range():
                range_text = self.help.format_bet_range(
                    suggestion,
                    bankroll=self.bankroll,
                    min_bet=self.min_bet,
                )
                self.ui.show_betting_advice(
                    count_info, suggestion, exact=False, range_text=range_text
                )

        bet = self._prompt_bet_with_level_command(suggestion)
        if bet is None:
            return False

        self._round_review.bet_amount = bet
        self._round_review.suggested_bet = suggestion.amount
        self.stats.record_bet(bet == suggestion.amount)

        self.bankroll -= bet
        self.session.record_wager(bet)
        player_hands = [PlayerHandState(hand=Hand(), bet=bet)]

        self._deal_initial_cards(player_hands[0], self.dealer)

        dealer_up = self.dealer.cards[0].rank
        insurance_bet = 0
        if dealer_up == Rank.ACE:
            insurance_bet = self._offer_insurance(bet)

        dealer_peek_bj = dealer_up == Rank.ACE or dealer_up.is_ten_value

        if self._resolve_initial_blackjacks(
            player_hands, dealer_peek_bj, insurance_bet=insurance_bet
        ):
            self._finish_round()
            return self.ui.confirm_continue()

        self._player_turn(player_hands)
        self._dealer_turn(player_hands)
        self._settle_all(player_hands)
        self._finish_round()
        return self.ui.confirm_continue()

    # ------------------------------------------------------------------
    # Shoe management
    # ------------------------------------------------------------------

    def _ensure_shoe_ready(self) -> None:
        if self.shoe.needs_reshuffle() or self.shoe.cards_remaining < 20:
            if self.help.post_shoe_summary() and self.help.current_shoe.hands_played > 0:
                self.ui.show_message(self.help.render_shoe_report(self.help.current_shoe))
            self.stats.record_shoe_complete()
            self.help.new_shoe()
            self.shoe.reset()
            self._bootstrap_counter_from_shoe(verbose=self.help.show_per_card_count_updates())
            self.ui.show_shoe_status(self.shoe.summary())

    def _bootstrap_counter_from_shoe(self, *, verbose: bool) -> None:
        """Reset count and apply burn card(s) already removed by the shoe."""
        self.counter.reset()
        for burned in self.shoe.burned_cards:
            tag = self.counter.observe(burned)
            if verbose:
                self.ui.show_count(
                    self.get_count_info(),
                    card_note=f"burn {burned.display()} ({tag:+d})",
                )

    def get_count_info(self) -> CountInfo:
        """Public snapshot of running count, true count, and decks remaining."""
        return self.counter.get_count_info(self.shoe)

    def _deal_and_count(self, hand: Hand, *, note: str) -> Card:
        """
        Deal one card from the shoe, update Hi-Lo count, add to hand.

        Every card that leaves the shoe is counted immediately — burn cards,
        hole cards, and hits alike — so the running count always matches the
        physical cards removed from the pack.
        """
        card = self.shoe.deal()
        tag = self.counter.observe(card)
        hand.add(card)
        if self.help.show_per_card_count_updates():
            self.ui.show_count(
                self.get_count_info(),
                card_note=f"{note} {card.display()} ({tag:+d})",
            )
        return card

    def _show_table_with_count(
        self,
        player_label: str,
        player_hand: Hand,
        *,
        hide_dealer_hole: bool,
    ) -> None:
        self.ui.show_table(
            player_label,
            player_hand,
            self.dealer,
            hide_dealer_hole=hide_dealer_hole,
        )
        if self.help.show_count_at_table():
            self.ui.show_count(
                self.get_count_info(),
                hole_hidden=hide_dealer_hole,
            )

    def _end_of_hand_count_display(self) -> None:
        info = self.get_count_info()
        print(f"\n--- End of hand count: {info.formatted()} ---")

    def _finish_round(self) -> None:
        if self._round_review:
            self._round_review.running_at_end = self.counter.running_count
            self._round_review.true_at_end = self.get_count_info().true_count

        if self.help.show_end_of_hand_count():
            self._end_of_hand_count_display()

        if self.help.post_hand_full_explanation() and self._round_review:
            self.ui.show_round_review(self.help.explain_round(self._round_review))

        self._post_hand_count_drill()

        if self.help.show_session_stats_each_hand():
            self.ui.show_session_stats(self.session.summary(self.bankroll))

        self.help.current_shoe.hands_played += 1
        self.session.hands_played += 1
        rank_up, level_up = self.stats.record_hand_end(
            self.bankroll, self._hand_net_pl
        )
        self._persist()
        if rank_up is not None:
            self.ui.show_message(
                f"★ Rank up! You are now {rank_up.title}. "
                f"{rank_up.unlock_blurb}"
            )
        if level_up is not None:
            self.help.set_level(level_up)
            self.ui.show_help_level(
                f"Auto-promoted to Help Level {int(level_up)} — "
                f"{self.help.format_level_banner()}"
            )

    def _offer_insurance(self, main_bet: int) -> int:
        """Optional 2:1 side bet when dealer's upcard is Ace."""
        max_bet = max_insurance_bet(main_bet)
        if max_bet < 1:
            return 0
        amount = self.ui.prompt_insurance(max_bet, self.bankroll)
        if amount <= 0:
            return 0
        self.bankroll -= amount
        self.session.record_wager(amount)
        self.session.insurance_taken += 1
        return amount

    def _settle_insurance(self, insurance_bet: int, dealer_has_blackjack: bool) -> None:
        if insurance_bet <= 0:
            return
        net = insurance_payout(insurance_bet, dealer_has_blackjack)
        if dealer_has_blackjack:
            self.bankroll += insurance_bet + net  # return wager + 2:1 profit
            self.session.insurance_won += 1
            self.ui.show_message(
                f"Insurance pays! +${net} (dealer blackjack)"
            )
        else:
            self.ui.show_message(f"Insurance lost -${insurance_bet}")
        self.session.net_profit_loss += net

    def _post_hand_count_drill(self) -> None:
        if self.help.post_hand_count_quiz_optional():
            guess = self.ui.prompt_count_guess()
            if guess is not None:
                self._grade_count_guess(guess)
            return

        if self.help.post_hand_count_quiz():
            guess = self.ui.prompt_count_guess_required()
            if guess is not None:
                self._grade_count_guess(guess)

    def _grade_count_guess(self, guess: int) -> None:
        actual = self.counter.running_count
        correct = self.accuracy.record_guess(guess, actual)
        self.stats.record_count_guess(correct)
        self.help.current_shoe.guesses += 1
        if correct:
            self.help.current_shoe.correct += 1
        self.ui.show_count_guess_result(
            guess,
            actual,
            correct=correct,
            tolerance=self.accuracy.tolerance,
        )
        print(f"  {self.accuracy.summary()}")

    def _handle_reset_progress(self) -> bool:
        """Wipe save file. Returns True if reset was confirmed."""
        if not self.ui.confirm_reset():
            print("  Reset cancelled.")
            return False
        self.progression.reset_progress()
        self._save_data = SaveData()
        self.stats = self._save_data.stats
        self.help.set_level(self.stats.help_level_enum)
        self.ui.show_message(
            "Progress reset. Stats and rank cleared — bankroll unchanged this session."
        )
        self._persist()
        return True

    def _prompt_bet_with_level_command(self, suggestion) -> int | None:
        while True:
            raw = input(
                "Place bet (Enter=${0}, 'level N', 'reset', q=quit): ".format(
                    suggestion.amount
                )
            ).strip()
            if not raw:
                return suggestion.amount
            lowered = raw.lower()
            if lowered in {"q", "quit", "exit"}:
                return None
            if lowered in {"help", "help level", "levels"}:
                self.ui.show_help_level_menu()
                continue
            if lowered in {"stats", "view stats", "statistics"}:
                self.ui.show_player_stats(
                    self.stats.format_stats(current_bankroll=self.bankroll)
                )
                continue
            if lowered in {"reset", "reset progress", "wipe"}:
                self._handle_reset_progress()
                continue
            new_level = self.help.parse_level_command(lowered)
            if new_level is not None:
                self._set_help_level(new_level)
                continue
            try:
                amount = int(raw)
            except ValueError:
                print("  Enter a bet amount, 'level N', 'reset', or q.")
                continue
            if amount < self.min_bet:
                print(f"  Minimum bet is ${self.min_bet}.")
                continue
            if amount > self.bankroll:
                print(f"  You only have ${self.bankroll:,}.")
                continue
            return amount

    def _set_help_level(self, level: HelpLevel) -> None:
        self.help.set_level(level)
        self.stats.set_help_level(level)
        self._persist()
        self.ui.show_help_level(self.help.format_level_banner())

    def _prompt_action_with_level(
        self,
        *,
        can_double: bool,
        can_split: bool,
        allow_chart: bool,
    ) -> str:
        while True:
            raw = input(
                self._action_prompt_hint(can_double, can_split, allow_chart)
            ).strip().lower()

            if raw in {"help", "help level", "levels"}:
                self.ui.show_help_level_menu()
                continue
            if raw in {"stats", "view stats", "statistics"}:
                self.ui.show_player_stats(
                    self.stats.format_stats(current_bankroll=self.bankroll)
                )
                continue

            new_level = self.help.parse_level_command(raw)
            if new_level is not None:
                self._set_help_level(new_level)
                continue

            if raw in {"strategy", "show basic strategy", "show strategy", "chart"}:
                if allow_chart:
                    self.ui.show_basic_strategy_chart()
                else:
                    print("  Strategy chart disabled at this help level.")
                continue

            valid = {
                "h": "hit", "hit": "hit",
                "s": "stand", "stand": "stand",
                "d": "double", "double": "double",
                "p": "split", "split": "split",
            }
            action = valid.get(raw)
            if action is None:
                print("  Invalid choice. Try again.")
                continue
            if action == "double" and not can_double:
                print("  Double is not available right now.")
                continue
            if action == "split" and not can_split:
                print("  Split is not available right now.")
                continue
            return action

    @staticmethod
    def _action_prompt_hint(can_double: bool, can_split: bool, allow_chart: bool) -> str:
        options = ["H]it", "S]tand"]
        if can_double:
            options.append("D]ouble")
        if can_split:
            options.append("P]plit")
        hint = "  ".join(options)
        extras = "  |  'level N'"
        if allow_chart:
            extras += "  |  'strategy'"
        return f"Your move ({hint}{extras}): "

    # ------------------------------------------------------------------
    # Initial deal & blackjacks
    # ------------------------------------------------------------------

    def _deal_initial_cards(self, player_state: PlayerHandState, dealer: Hand) -> None:
        # Alternate deals: player, dealer, player, dealer (standard order).
        self._deal_and_count(player_state.hand, note="player")
        self._deal_and_count(dealer, note="dealer up")
        self._deal_and_count(player_state.hand, note="player")
        self._deal_and_count(dealer, note="dealer hole")

        self._show_table_with_count("You", player_state.hand, hide_dealer_hole=True)

    def _resolve_initial_blackjacks(
        self,
        player_hands: list[PlayerHandState],
        dealer_peek_bj: bool,
        *,
        insurance_bet: int = 0,
    ) -> bool:
        """
        Handle natural-blackjack situations before player acts.

        Returns True if the round ended early.
        """
        player = player_hands[0].hand
        player_bj = player.is_blackjack()
        dealer_up = self.dealer.cards[0].rank
        dealer_bj = self.dealer.is_blackjack() if dealer_peek_bj else False

        if dealer_up == Rank.ACE and insurance_bet > 0:
            self._settle_insurance(insurance_bet, dealer_bj)

        if dealer_peek_bj and (dealer_bj or player_bj):
            self._show_table_with_count("You", player, hide_dealer_hole=False)
            self._settle_hand(player_hands[0], reveal_dealer=True)
            return True

        if player_bj:
            self._settle_hand(player_hands[0], reveal_dealer=True)
            return True

        return False

    # ------------------------------------------------------------------
    # Player actions
    # ------------------------------------------------------------------

    def _player_turn(self, player_hands: list[PlayerHandState]) -> None:
        hand_index = 0
        split_done = False

        while hand_index < len(player_hands):
            state = player_hands[hand_index]

            if state.finished:
                hand_index += 1
                continue

            label = self._hand_label(hand_index, len(player_hands))

            # Split aces: one card each, then auto-stand (no player choices).
            if state.split_aces:
                self._show_table_with_count(label, state.hand, hide_dealer_hole=True)
                state.finished = True
                hand_index += 1
                continue

            while not state.finished:
                self._show_table_with_count(label, state.hand, hide_dealer_hole=True)

                can_double = (
                    state.hand.size == 2
                    and not state.doubled
                    and self.bankroll >= state.bet
                )
                can_split = (
                    not split_done
                    and len(player_hands) == 1
                    and _can_split(state.hand)
                    and self.bankroll >= state.bet
                )

                advice = BasicStrategy.advise(
                    state.hand,
                    self.dealer.cards[0].rank,
                    can_double=can_double,
                    can_split=can_split,
                )
                hand_total = state.hand.value()

                if self.help.should_show_strategy_hint(
                    advice, hand_total=hand_total
                ):
                    self.ui.show_strategy_advice(advice)

                action = self._prompt_action_with_level(
                    can_double=can_double,
                    can_split=can_split,
                    allow_chart=self.help.allow_strategy_chart(),
                )

                if self._round_review:
                    self.help.record_decision(
                        self._round_review, action, advice, hand_total
                    )
                    self.stats.record_decision(
                        not self.help.is_strategy_mistake(action, advice)
                    )
                    if (
                        self.help.level in {HelpLevel.GUIDED, HelpLevel.PRACTICE}
                        and self.help.is_strategy_mistake(action, advice)
                    ):
                        self.ui.show_strategy_advice(advice)

                if action == "split":
                    split_done = True
                    player_hands = self._split_hand(state)
                    hand_index = 0
                    break

                if action == "double":
                    self.bankroll -= state.bet
                    self.session.record_wager(state.bet)
                    state.bet *= 2
                    state.doubled = True
                    self._deal_and_count(state.hand, note="double")
                    state.finished = True
                    break

                if action == "hit":
                    self._deal_and_count(state.hand, note="hit")
                    if state.hand.is_bust() or state.hand.is_twenty_one():
                        state.finished = True
                    continue

                state.finished = True

            if hand_index < len(player_hands) and player_hands[hand_index].finished:
                hand_index += 1

    def _split_hand(self, state: PlayerHandState) -> list[PlayerHandState]:
        """Split one pair into two hands (one split per round)."""
        card_a, card_b = state.hand.cards
        is_aces = card_a.rank == Rank.ACE

        self.bankroll -= state.bet
        self.session.record_wager(state.bet)

        hand_one = Hand([card_a])
        hand_two = Hand([card_b])

        self._deal_and_count(hand_one, note="split")
        self._deal_and_count(hand_two, note="split")

        return [
            PlayerHandState(
                hand=hand_one,
                bet=state.bet,
                is_from_split=True,
                split_aces=is_aces,
            ),
            PlayerHandState(
                hand=hand_two,
                bet=state.bet,
                is_from_split=True,
                split_aces=is_aces,
            ),
        ]

    # ------------------------------------------------------------------
    # Dealer
    # ------------------------------------------------------------------

    def _dealer_turn(self, player_hands: list[PlayerHandState]) -> None:
        # If every player hand busted, dealer does not draw.
        if all(h.hand.is_bust() for h in player_hands):
            return

        self._show_table_with_count(
            "You",
            player_hands[0].hand,
            hide_dealer_hole=False,
        )

        while _dealer_should_hit(self.dealer):
            self._deal_and_count(self.dealer, note="dealer hit")
            print(f"Dealer hits → {self.dealer.summary()}")

    # ------------------------------------------------------------------
    # Settlement
    # ------------------------------------------------------------------

    def _settle_all(self, player_hands: list[PlayerHandState]) -> None:
        for index, state in enumerate(player_hands):
            label = self._hand_label(index, len(player_hands))
            self._settle_hand(state, reveal_dealer=True, label=label)

    def _settle_hand(
        self,
        state: PlayerHandState,
        *,
        reveal_dealer: bool,
        label: str = "You",
    ) -> None:
        if reveal_dealer:
            self._show_table_with_count(label, state.hand, hide_dealer_hole=False)

        result = _result_for_hand(state, self.dealer)
        net = calculate_payout(state.bet, result)
        self.bankroll += state.bet + net
        self.session.net_profit_loss += net
        self._hand_net_pl += net
        self.ui.show_result(label, result.value, net, state.bet)

    @staticmethod
    def _hand_label(index: int, total: int) -> str:
        if total <= 1:
            return "You"
        return f"Hand {index + 1}"


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------


def _can_split(hand: Hand) -> bool:
    """True when the hand is an unsplit pair (matching ranks)."""
    return (
        hand.size == 2
        and hand.cards[0].rank == hand.cards[1].rank
    )


def _dealer_should_hit(hand: Hand) -> bool:
    """
    Standard American rule: dealer hits on 16, stands on hard 17,
    but *hits* soft 17 (Ace + 6).
    """
    total = hand.value()
    if total < 17:
        return True
    if total == 17 and hand.is_soft():
        return True
    return False


def _result_for_hand(state: PlayerHandState, dealer: Hand) -> HandResult:
    """
    Compare player hand to dealer, respecting split-hand blackjack rules.

    Split hands (and split aces) that reach 21 pay 1:1, not 3:2 — so we
    downgrade a "blackjack" result to a plain win when ``is_from_split``.
    """
    result = compare_hands(state.hand, dealer)
    if state.is_from_split and result == HandResult.BLACKJACK:
        return HandResult.WIN
    return result