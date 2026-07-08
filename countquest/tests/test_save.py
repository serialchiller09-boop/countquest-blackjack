"""Tests for full SaveData persistence."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from countquest.models import HelpLevel
from countquest.progression import ProgressionManager, _is_legacy_stats_only
from countquest.save_data import GameSettings, PRACTICE_BANKROLL, SaveData
from countquest.stats import PlayerStats


class TestSaveData(unittest.TestCase):
    def test_round_trip_full_save(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "progress.json"
            mgr = ProgressionManager(path)
            save = SaveData(
                stats=PlayerStats(help_level=2, hands_played=42),
                bankroll=750,
                settings=GameSettings(
                    practice_mode=True,
                    clear_screen=False,
                    use_color=False,
                ),
                session_active=True,
                session_hands=5,
                session_net_pl=120,
            )
            mgr.save_save(save)
            loaded = mgr.load_save()

            self.assertEqual(loaded.stats.help_level_enum, HelpLevel.PRACTICE)
            self.assertEqual(loaded.stats.hands_played, 42)
            self.assertEqual(loaded.bankroll, 750)
            self.assertTrue(loaded.settings.practice_mode)
            self.assertFalse(loaded.settings.clear_screen)
            self.assertTrue(loaded.session_active)
            self.assertEqual(loaded.session_hands, 5)
            self.assertEqual(loaded.session_net_pl, 120)

    def test_legacy_stats_migration(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "progress.json"
            legacy = {"help_level": 1, "hands_played": 10, "player_name": "Ace"}
            path.write_text(json.dumps(legacy), encoding="utf-8")

            loaded = ProgressionManager(path).load_save()
            self.assertEqual(loaded.stats.help_level, 1)
            self.assertEqual(loaded.stats.hands_played, 10)
            self.assertEqual(loaded.stats.player_name, "Ace")
            self.assertEqual(loaded.version, 1)

    def test_reset_progress(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "progress.json"
            mgr = ProgressionManager(path)
            mgr.save_save(SaveData())
            self.assertTrue(mgr.exists())
            self.assertTrue(mgr.reset_progress())
            self.assertFalse(mgr.exists())
            self.assertFalse(mgr.reset_progress())

    def test_legacy_detection(self) -> None:
        self.assertTrue(_is_legacy_stats_only({"help_level": 0}))
        self.assertFalse(_is_legacy_stats_only({"version": 1, "stats": {}}))

    def test_mark_session_start(self) -> None:
        save = SaveData()
        save.mark_session_start(PRACTICE_BANKROLL)
        self.assertTrue(save.session_active)
        self.assertEqual(save.bankroll, PRACTICE_BANKROLL)
        self.assertEqual(save.session_hands, 0)


if __name__ == "__main__":
    unittest.main()