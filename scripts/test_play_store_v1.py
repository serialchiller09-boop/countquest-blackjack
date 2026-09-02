#!/usr/bin/env python3
"""Play Store v1 structure checks (first-run, dev panel, ship docs)."""
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

    def test_index_wires_first_run(self) -> None:
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("js/11-first-run.js", html)
        self.assertIn("js/12-tester-qa.js", html)
        self.assertIn(">v46<", html)
        self.assertNotIn("?v=45", html)
        self.assertIn("__CQ_DEV_MODE", html)
        self.assertIn('id="external-services-panel" hidden', html)
        self.assertNotIn("Skip Tutorial \u2192 Full Campaign", html)

    def test_sw_and_docs(self) -> None:
        sw = (ROOT / "sw.js").read_text(encoding="utf-8")
        self.assertIn("./js/11-first-run.js", sw)
        self.assertIn("./js/12-tester-qa.js", sw)
        self.assertTrue((ROOT / "docs" / "PLAY_STORE_SHIP_CHECKLIST.md").is_file())
        self.assertTrue((ROOT / "artifacts" / "store" / "feature-graphic.svg").is_file())
        self.assertTrue((ROOT / "artifacts" / "store" / "STORE_ASSETS.md").is_file())

    def test_dev_panel_hidden_in_css(self) -> None:
        css = (ROOT / "css" / "app.css").read_text(encoding="utf-8")
        self.assertIn("#external-services-panel { display: none !important; }", css)
        self.assertIn("html.cq-dev #external-services-panel", css)

    def test_minigame_close_not_disabled(self) -> None:
        engine = (ROOT / "js" / "07-game-engine.js").read_text(encoding="utf-8")
        self.assertIn("btn.textContent = ready ? 'Play Now' : 'Close';", engine)
        self.assertIn("btn.disabled = false;", engine)
        self.assertNotIn("Configure OAuth in Settings", engine)
        qa = (ROOT / "js" / "12-tester-qa.js").read_text(encoding="utf-8")
        self.assertIn("btn-lobby-minigame-action", qa)
        self.assertIn("btn-lobby-minigame-close", qa)


if __name__ == "__main__":
    raise SystemExit(unittest.main())
