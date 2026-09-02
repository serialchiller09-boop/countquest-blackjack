#!/usr/bin/env python3
"""Play Store v1 / v47 structure checks (first-run, dev panel, ship docs)."""
from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PlayStoreV1Tests(unittest.TestCase):
    def test_first_run_module(self) -> None:
        js = (ROOT / "js" / "11-first-run.js").read_text(encoding="utf-8")
        self.assertIn("cq.firstRunV1", js)
        self.assertIn("Quest Through the Casinos", js)
        self.assertIn("Learn Hi-Lo by playing, not by reading a book.", js)
        self.assertIn("openTutorial", js)
        self.assertIn("openTableLobby", js)
        self.assertIn("callApp", js)
        self.assertIn("#external-services-panel", js)
        self.assertIn("html.cq-dev", js)
        self.assertIn("__CQ_TEST_MODE", js)
        self.assertIn("rgba(255,255,255,.06)", js)

    def test_index_wires_first_run(self) -> None:
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        tutorial = (ROOT / "js" / "08-tutorial.js").read_text(encoding="utf-8")
        self.assertIn("js/11-first-run.js", html)
        self.assertIn("__CQ_DEV_MODE", html)
        self.assertTrue(
            ">v46<" in html or ">v47<" in html,
            "index.html must show a v46 or v47 build stamp",
        )
        self.assertTrue(
            "js/12-tester-qa.js" in html or "12-tester-qa.js" in tutorial,
            "12-tester-qa.js must be in index.html or injected from 08-tutorial.js",
        )

    def test_sw_and_docs(self) -> None:
        sw = (ROOT / "sw.js").read_text(encoding="utf-8")
        self.assertIn("./js/11-first-run.js", sw)
        self.assertIn("./js/12-tester-qa.js", sw)
        self.assertIn("./css/play-store-v1.css", sw)
        self.assertTrue((ROOT / "docs" / "PLAY_STORE_SHIP_CHECKLIST.md").is_file())
        self.assertTrue((ROOT / "artifacts" / "store" / "feature-graphic.svg").is_file())
        self.assertTrue((ROOT / "artifacts" / "store" / "STORE_ASSETS.md").is_file())

    def test_dev_panel_hidden_in_css(self) -> None:
        overlay = (ROOT / "css" / "play-store-v1.css").read_text(encoding="utf-8")
        self.assertIn("#external-services-panel", overlay)
        self.assertIn("display: none !important", overlay)
        self.assertIn("html.cq-dev #external-services-panel", overlay)
        self.assertIn("html.cq-native #external-services-panel", overlay)
        qa = (ROOT / "js" / "12-tester-qa.js").read_text(encoding="utf-8")
        self.assertIn("#external-services-panel{display:none!important}", qa)
        self.assertIn("html.cq-dev #external-services-panel{display:block!important}", qa)

    def test_minigame_close_not_disabled(self) -> None:
        qa = (ROOT / "js" / "12-tester-qa.js").read_text(encoding="utf-8")
        self.assertIn("btn-lobby-minigame-action", qa)
        self.assertIn("btn-lobby-minigame-close", qa)
        self.assertIn("action.disabled = false", qa)
        self.assertIn("enableMinigameClose", qa)
        self.assertIn("Configure OAuth in Settings", qa)
        self.assertIn("Local connect", qa)
        self.assertIn("Skip Tutorial", qa)
        self.assertIn("joinTable", qa)

    def test_reset_clears_first_run_flag(self) -> None:
        storage = (ROOT / "js" / "06b-validation.js").read_text(encoding="utf-8")
        self.assertIn("cq.firstRunV1", storage)
        qa = (ROOT / "js" / "12-tester-qa.js").read_text(encoding="utf-8")
        self.assertIn("cq.firstRunV1", qa)
        self.assertIn("clearFirstRunFlag", qa)
        self.assertIn("confirmResetProgress", qa)

    def test_locked_table_uses_minrank_name(self) -> None:
        qa = (ROOT / "js" / "12-tester-qa.js").read_text(encoding="utf-8")
        self.assertIn("RANK_NAMES", qa)
        self.assertIn("Journeyman", qa)
        self.assertIn("lockedTableMessage", qa)
        self.assertIn("minRank", qa)
        self.assertIn("dataset.locked", qa)


if __name__ == "__main__":
    raise SystemExit(unittest.main())
