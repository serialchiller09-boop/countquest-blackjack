"""Tests for count-based bet sizing."""

from __future__ import annotations

import unittest

from countquest.betting import (
    SessionStats,
    insurance_payout,
    suggest_bet,
    true_count_units,
)


class TestTrueCountUnits(unittest.TestCase):
    def test_tc_zero_is_one_unit(self) -> None:
        self.assertEqual(true_count_units(0.0), 1)
        self.assertEqual(true_count_units(-2.0), 1)

    def test_tc_ramp_linear(self) -> None:
        self.assertEqual(true_count_units(1.0), 2)
        self.assertEqual(true_count_units(1.9), 2)
        self.assertEqual(true_count_units(2.0), 3)
        self.assertEqual(true_count_units(5.0), 6)
        self.assertEqual(true_count_units(8.0), 6)


class TestSuggestBet(unittest.TestCase):
    def test_high_tc_increases_suggestion(self) -> None:
        low = suggest_bet(0.0, bankroll=1000, unit_size=10, min_bet=10)
        mid = suggest_bet(2.5, bankroll=1000, unit_size=10, min_bet=10)
        high = suggest_bet(5.0, bankroll=1000, unit_size=10, min_bet=10)

        self.assertEqual(low.amount, 10)
        self.assertEqual(mid.amount, 30)
        self.assertEqual(high.amount, 60)
        self.assertLess(low.amount, mid.amount)
        self.assertLess(mid.amount, high.amount)

    def test_bankroll_cap_at_ten_percent(self) -> None:
        # 6 units × $10 = $60, but 10% of $400 = $40
        suggestion = suggest_bet(5.0, bankroll=400, unit_size=10, min_bet=10)
        self.assertEqual(suggestion.amount, 40)
        self.assertTrue(suggestion.capped_by_bankroll)

    def test_scenario_tc_climbs_through_session(self) -> None:
        """Simulate rising true count — suggestions should monotonically increase."""
        bankroll = 2000
        amounts = [
            suggest_bet(tc, bankroll=bankroll, unit_size=10, min_bet=10).amount
            for tc in [0.0, 1.2, 2.1, 3.0, 4.5, 5.5]
        ]
        self.assertEqual(amounts, [10, 20, 30, 40, 50, 60])
        for earlier, later in zip(amounts, amounts[1:]):
            self.assertLessEqual(earlier, later)


class TestInsurance(unittest.TestCase):
    def test_insurance_pays_two_to_one(self) -> None:
        self.assertEqual(insurance_payout(25, True), 50)
        self.assertEqual(insurance_payout(25, False), -25)


class TestSessionStats(unittest.TestCase):
    def test_tracks_wagers_and_pl(self) -> None:
        stats = SessionStats(starting_bankroll=1000)
        stats.record_wager(25)
        stats.record_result(25)
        self.assertEqual(stats.total_wagered, 25)
        self.assertEqual(stats.net_profit_loss, 25)


if __name__ == "__main__":
    unittest.main()