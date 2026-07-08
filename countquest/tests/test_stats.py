"""Tests for PlayerStats and progression."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from countquest.models import HelpLevel
from countquest.progression import ProgressionManager
from countquest.stats import PlayerRank, PlayerStats


class TestPlayerStats(unittest.TestCase):
    def test_count_accuracy(self) -> None:
        stats = PlayerStats()
        stats.record_count_guess(True)
        stats.record_count_guess(False)
        self.assertEqual(stats.count_accuracy_pct, 50.0)

    def test_decision_accuracy(self) -> None:
        stats = PlayerStats()
        stats.record_decision(True)
        stats.record_decision(True)
        stats.record_decision(False)
        self.assertAlmostEqual(stats.decision_accuracy_pct, 66.7, places=1)

    def test_recent_count_window(self) -> None:
        stats = PlayerStats()
        for _ in range(40):
            stats.record_count_guess(True)
        for _ in range(10):
            stats.record_count_guess(False)
        self.assertEqual(stats.recent_count_accuracy(50), 80.0)

    def test_auto_help_level_up(self) -> None:
        stats = PlayerStats(help_level=0, hands_played=49)
        for _ in range(20):
            stats.record_count_guess(True)
        stats.record_hand_end(1000)
        self.assertEqual(stats.help_level, 0)

        stats.hands_played = 50
        stats.last_level_up_hand = 0
        for _ in range(35):
            stats.record_count_guess(True)
        for _ in range(30):
            stats.record_decision(True)
        stats.decisions_total = 30
        stats.decisions_correct = 26
        promoted = stats.try_auto_help_level_up()
        self.assertEqual(promoted, HelpLevel.GUIDED)

    def test_rank_promotion(self) -> None:
        stats = PlayerStats(hands_played=23, rank=0)
        _, _ = stats.record_hand_end(1000)
        self.assertEqual(stats.hands_played, 24)
        self.assertEqual(stats.rank_enum, PlayerRank.NOVICE)

        stats.count_guesses = 10
        stats.count_correct = 8
        stats.decisions_total = 20
        stats.decisions_correct = 16
        rank, _ = stats.record_hand_end(1000)
        self.assertEqual(stats.hands_played, 25)
        self.assertEqual(rank, PlayerRank.APPRENTICE)

    def test_bankroll_history(self) -> None:
        stats = PlayerStats()
        stats.record_hand_end(1000)
        stats.record_hand_end(1050)
        self.assertEqual(stats.bankroll_min(), 1000)
        self.assertEqual(stats.bankroll_max(), 1050)
        self.assertEqual(stats.bankroll_average(), 1025.0)

    def test_rough_ev_negative_at_start(self) -> None:
        stats = PlayerStats(hands_played=5)
        self.assertLess(stats.rough_ev_estimate_pct(), 0)


class TestProgressionSave(unittest.TestCase):
    def test_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "progress.json"
            mgr = ProgressionManager(path)
            stats = PlayerStats(help_level=2, rank=1, hands_played=42)
            mgr.save(stats)
            loaded = mgr.load()
            self.assertEqual(loaded.hands_played, 42)
            self.assertEqual(loaded.rank_enum, PlayerRank.APPRENTICE)


if __name__ == "__main__":
    unittest.main()