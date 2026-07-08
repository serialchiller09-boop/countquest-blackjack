"""Tests for progress save/load."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from countquest.models import HelpLevel
from countquest.progression import ProgressionManager
from countquest.stats import PlayerStats


class TestProgression(unittest.TestCase):
    def test_save_and_load_help_level(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "progress.json"
            mgr = ProgressionManager(path)
            stats = PlayerStats(help_level=2)
            mgr.save(stats)
            loaded = mgr.load()
            self.assertEqual(loaded.help_level_enum, HelpLevel.PRACTICE)

    def test_backward_compat_save_stats_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "progress.json"
            mgr = ProgressionManager(path)
            mgr.save(PlayerStats(rank=1, hands_played=30))
            save = mgr.load_save()
            self.assertEqual(save.stats.rank, 1)
            self.assertEqual(save.stats.hands_played, 30)


if __name__ == "__main__":
    unittest.main()