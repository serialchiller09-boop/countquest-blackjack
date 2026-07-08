"""Tests for progressive help visibility rules."""

from __future__ import annotations

import unittest

from countquest.help_system import HelpSystem
from countquest.models import HelpLevel
from countquest.strategy import StrategyAction, StrategyAdvice


class TestHelpVisibility(unittest.TestCase):
    def test_novice_shows_everything(self) -> None:
        h = HelpSystem(HelpLevel.NOVICE)
        self.assertTrue(h.show_count_during_play())
        self.assertTrue(h.show_strategy_always())
        self.assertTrue(h.show_exact_bet())
        self.assertTrue(h.post_hand_full_explanation())

    def test_practice_hides_count_in_play(self) -> None:
        h = HelpSystem(HelpLevel.PRACTICE)
        self.assertTrue(h.hide_count_completely_in_play())
        self.assertFalse(h.show_count_at_table())
        self.assertTrue(h.post_hand_count_quiz())

    def test_expert_blocks_hints(self) -> None:
        h = HelpSystem(HelpLevel.EXPERT)
        self.assertTrue(h.block_strategy_hints())
        self.assertFalse(h.show_bet_suggestion())
        self.assertFalse(h.show_session_stats_each_hand())
        self.assertTrue(h.expert_session_analytics_only())

    def test_guided_uses_bet_range(self) -> None:
        h = HelpSystem(HelpLevel.GUIDED)
        self.assertTrue(h.show_bet_range())
        self.assertFalse(h.show_exact_bet())
        self.assertTrue(h.require_pre_round_count_confirm())

    def test_level_command_parsing(self) -> None:
        h = HelpSystem()
        self.assertEqual(h.parse_level_command("level 3"), HelpLevel.CHALLENGE)
        self.assertEqual(h.parse_level_command("help 0"), HelpLevel.NOVICE)


class TestStrategyGating(unittest.TestCase):
    def test_mistake_detection(self) -> None:
        advice = StrategyAdvice(StrategyAction.STAND, "stand")
        self.assertTrue(HelpSystem.is_strategy_mistake("hit", advice))

    def test_practice_shows_clear_risk_only(self) -> None:
        h = HelpSystem(HelpLevel.PRACTICE)
        hit_advice = StrategyAdvice(StrategyAction.HIT, "hit")
        stand_advice = StrategyAdvice(StrategyAction.STAND, "stand")
        self.assertTrue(
            h.should_show_strategy_hint(hit_advice, hand_total=16)
        )
        self.assertFalse(
            h.should_show_strategy_hint(stand_advice, hand_total=20)
        )


if __name__ == "__main__":
    unittest.main()