#!/usr/bin/env python3
"""Run CountQuest web logic tests (mirrors index.html runTests)."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

# Reuse Python prototype tests as source of truth for ported logic.
from countquest.card import Card
from countquest.counter import HiLoCounter
from countquest.deck import Shoe
from countquest.hand import Hand, calculate_payout, compare_hands, HandResult
from countquest.betting import suggest_bet, true_count_units
from countquest.game import _dealer_should_hit
from countquest.help_system import HelpSystem
from countquest.models import HelpLevel, Rank, Suit
from countquest.strategy import BasicStrategy
from web_logic_reference import (
    KO_PIVOT_BY_DECKS,
    bet_spread_units_ko,
    bet_spread_units_true_count,
    get_ko_pivot,
    hi_lo_tag,
    is_ten_value_rank,
    ko_tag,
    normalize_rank,
)
from load_project_source import JS_MODULES, load_app_source, load_index_html


def c(rank: Rank, suit: Suit = Suit.SPADES) -> Card:
    return Card(rank=rank, suit=suit)


class TestWebLogicParity(unittest.TestCase):
    """Assertions matching index.html runTests()."""

    def test_blackjack_hand(self) -> None:
        h = Hand([c(Rank.ACE, Suit.SPADES), c(Rank.KING, Suit.HEARTS)])
        self.assertTrue(h.is_blackjack())

    def test_hi_lo_tags(self) -> None:
        self.assertEqual(c(Rank.FIVE).hi_lo_value(), 1)
        self.assertEqual(c(Rank.KING).hi_lo_value(), -1)

    def test_ko_tags_in_html(self) -> None:
        html = load_app_source()
        self.assertIn("getKoTagForCard", html)
        self.assertIn("'ko'", html)
        self.assertIn("countingUnlocks", html)
        self.assertIn("betSpreadUnitsFromKoRunningCount", html)

    def test_shoe_single_deck_size(self) -> None:
        shoe = Shoe(num_decks=1)
        self.assertEqual(shoe.initial_count, 52)

    def test_running_count(self) -> None:
        cnt = HiLoCounter()
        cnt.observe(c(Rank.TWO))
        self.assertEqual(cnt.running_count, 1)

    def test_payouts(self) -> None:
        self.assertEqual(calculate_payout(10, HandResult.BLACKJACK), 15)
        self.assertEqual(calculate_payout(10, HandResult.WIN), 10)

    def test_dealer_soft_17(self) -> None:
        self.assertTrue(_dealer_should_hit(Hand([c(Rank.ACE), c(Rank.SIX)])))
        self.assertFalse(_dealer_should_hit(Hand([c(Rank.TEN), c(Rank.SEVEN)])))

    def test_suggest_bet(self) -> None:
        sug = suggest_bet(2.0, bankroll=1000, unit_size=10, min_bet=10)
        self.assertGreaterEqual(sug.amount, 10)

    def test_stand_16_vs_6(self) -> None:
        hand = Hand([c(Rank.TEN), c(Rank.SIX)])
        advice = BasicStrategy.advise(hand, Rank.SIX, can_double=False, can_split=False)
        self.assertEqual(advice.action.value, "stand")

    def test_help_level_2(self) -> None:
        help_sys = HelpSystem(HelpLevel.PRACTICE)
        self.assertFalse(help_sys.show_count_at_table())
        self.assertTrue(help_sys.post_hand_count_quiz())

    def test_surrender_payout_parity(self) -> None:
        self.assertEqual(calculate_payout(20, HandResult.LOSS), -20)

    def test_rank_ten_value_not_t(self) -> None:
        self.assertEqual(Rank.TEN.value, "10")
        self.assertEqual(str(c(Rank.TEN, Suit.HEARTS)), "10♥")


class TestWebLogicHard(unittest.TestCase):
    """Stricter parity + boundary tests against index.html logic."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.html = load_app_source()

    def test_ranks_array_uses_10_not_t(self) -> None:
        m = re.search(r"const RANKS = (\[[^\]]+\])", self.html)
        self.assertIsNotNone(m)
        ranks = json.loads(m.group(1).replace("'", '"'))
        self.assertIn("10", ranks)
        self.assertNotIn("T", ranks)
        self.assertEqual(len(ranks), 13)

    def test_ko_pivot_table_in_html_matches_reference(self) -> None:
        m = re.search(r"const KO_PIVOT_BY_DECKS = (\{[^}]+\})", self.html)
        self.assertIsNotNone(m)
        raw = m.group(1)
        for deck, pivot in KO_PIVOT_BY_DECKS.items():
            with self.subTest(deck=deck):
                self.assertIn(f"{deck}: {pivot}", raw)

    def test_ko_pivot_helper_boundaries(self) -> None:
        self.assertEqual(get_ko_pivot(1), 0)
        self.assertEqual(get_ko_pivot(6), 4)
        self.assertEqual(get_ko_pivot(8), 4)
        self.assertEqual(get_ko_pivot(99), 4)
        self.assertEqual(get_ko_pivot(0), 4)

    def test_hi_lo_tag_table(self) -> None:
        self.assertEqual(hi_lo_tag("5"), 1)
        self.assertEqual(hi_lo_tag("7"), 0)
        self.assertEqual(hi_lo_tag("10"), -1)
        self.assertEqual(hi_lo_tag("A"), -1)

    def test_ko_tag_seven_differs_from_hi_lo(self) -> None:
        self.assertEqual(ko_tag("7"), 1)
        self.assertEqual(hi_lo_tag("7"), 0)

    def test_ten_value_ranks_include_10_and_legacy_t(self) -> None:
        self.assertTrue(is_ten_value_rank("10"))
        self.assertTrue(is_ten_value_rank("T"))
        self.assertFalse(is_ten_value_rank("9"))

    def test_normalize_rank_legacy_t(self) -> None:
        self.assertEqual(normalize_rank("T"), "10")
        self.assertEqual(normalize_rank("10"), "10")

    def test_true_count_spread_boundaries(self) -> None:
        self.assertEqual(bet_spread_units_true_count(0), 1)
        self.assertEqual(bet_spread_units_true_count(0.99), 1)
        self.assertEqual(bet_spread_units_true_count(1), 2)
        self.assertEqual(bet_spread_units_true_count(5.99), 6)
        self.assertEqual(bet_spread_units_true_count(100), 6)

    def test_ko_spread_boundaries(self) -> None:
        pivot = 4
        self.assertEqual(bet_spread_units_ko(4, pivot), 1)
        self.assertEqual(bet_spread_units_ko(3, pivot), 1)
        self.assertEqual(bet_spread_units_ko(5, pivot), 2)
        self.assertEqual(bet_spread_units_ko(9, pivot), 6)

    def test_python_betting_matches_reference_spread(self) -> None:
        for tc in [0.0, 1.0, 2.5, 5.0, 8.0]:
            with self.subTest(tc=tc):
                self.assertEqual(true_count_units(tc), bet_spread_units_true_count(tc))

    def test_ko_unlock_thresholds_documented_in_html(self) -> None:
        self.assertIn("helpLevel >= 2", self.html)
        self.assertIn("countGuesses >= 25", self.html)
        self.assertIn("calculateCountAccuracyPercent(st) >= 75", self.html)

    def test_save_version_and_counting_fields(self) -> None:
        self.assertIn("const SAVE_VERSION = 18", self.html)
        self.assertIn("countingUnlocks", self.html)
        self.assertIn("countingSystem", self.html)
        self.assertIn("syncWalletSave", self.html)
        self.assertIn("defaultClubMembership", self.html)

    def test_hand_total_with_rank_ten(self) -> None:
        hand = Hand([c(Rank.TEN), c(Rank.SIX)])
        self.assertEqual(hand.value(), 16)
        self.assertFalse(hand.is_soft())

    def test_blackjack_with_ten_and_ace(self) -> None:
        hand = Hand([c(Rank.TEN), c(Rank.ACE)])
        self.assertTrue(hand.is_blackjack())

    def test_beginner_friendly_labels_in_html(self) -> None:
        self.assertIn("formatCountChangeLabel", self.html)
        self.assertIn("beginnerDisplaySummary", self.html)
        self.assertIn("btn-count-quiz-continue", self.html)
        self.assertIn("Got it — Next", self.html)
        self.assertIn("toggle-count-display", self.html)
        self.assertIn("Count Change:", self.html)
        self.assertNotIn("setTimeout(() => document.getElementById('modal-count-quiz').close()", self.html)

    def test_tutorial_navigation_helpers_in_html(self) -> None:
        self.assertIn("exitTutorial()", self.html)
        self.assertIn("lockTutorialNav", self.html)
        self.assertIn("tutorial back on page 1 exits to menu", self.html)
        self.assertIn("← Main Menu", self.html)
        self.assertIn("Skip Tutorial", self.html)

    def test_tutorial_count_explanation_is_system_aware(self) -> None:
        self.assertIn("updateTutorialCountExplanation", self.html)
        self.assertIn("countExplanation", self.html)
        self.assertIn("tutorial-count-explanation", self.html)
        self.assertIn("system === 'ko'", self.html)

    def test_branding_logo_and_themes(self) -> None:
        self.assertIn('id="logo"', self.html)
        self.assertIn("main-header", self.html)
        self.assertIn("app-title-sub", self.html)
        self.assertIn("cq-logo", self.html)
        self.assertIn("body.theme-neon .cq-logo", self.html)
        self.assertIn("initBranding", self.html)
        self.assertIn("image/svg+xml", self.html)

    def test_shoe_report_and_chart_are_system_aware(self) -> None:
        self.assertIn("buildStrategyChartContent", self.html)
        self.assertIn("buildSettingsAdvisoryText", self.html)
        self.assertIn("estimateShoeEVFromBetMetric", self.html)
        self.assertIn("Avg vs key", self.html)
        self.assertIn("shoe-modal-subtitle", self.html)
        self.assertIn("countingCtx", self.html)

    def test_run_tests_covers_hard_cases(self) -> None:
        """Browser runTests() must include expanded hard assertions."""
        required_phrases = [
            "T normalizes to 10",
            "four tens per deck",
            "KO pivots",
            "ko at pivot",
            "tc cap",
            "KO unlock blocked",
            "invalid countingSystem",
            "true count floor",
            "double 11 vs 6",
            "reject over bankroll",
            "header uses full width",
            "stats sidebar is collapsible overlay",
            "centered game table wrapper",
        ]
        start = self.html.find("function runTests()")
        self.assertGreater(start, 0)
        body = self.html[start : start + 12000]
        for phrase in required_phrases:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, body)


class TestIndexHtmlStructure(unittest.TestCase):
    def test_save_version_eleven(self) -> None:
        html = load_app_source()
        self.assertIn("const SAVE_VERSION = 18", html)
        self.assertIn("countingSystem: 'hi-lo'", html)
        self.assertIn("chips: 2500, gems: 10", html)
        self.assertIn("club: defaultClubMembership()", html)
        self.assertIn("dailyRewards: defaultDailyRewards()", html)
        self.assertIn("vipPass: defaultVipPass()", html)

    def test_required_ids_present(self) -> None:
        html = load_app_source()
        required = [
            "screen-menu", "screen-bet", "screen-table", "screen-casino-play", "screen-handend",
            "casino-seat-grid", "casino-seat-human",
            "screen-training", "training-drill-list", "btn-training-back",
            "screen-practice-range", "screen-tutorial", "screen-campaign", "screen-daily",
            "screen-drill-speed", "btn-speed-drill-start", "speed-drill-stats",
            "screen-drill-true-count", "btn-tc-drill-start", "tc-drill-stats",
            "btn-deal", "action-bar", "modal-insurance", "modal-count-quiz",
            "modal-settings", "counting-system-cards", "stats-sidebar", "shoe-status", "dealer-cards", "player-hands",
            "shoe-count-canvas", "rules-toggles", "practice-range-drills",
            "btn-export-stats", "btn-reset-progress-sidebar", "modal-reset",
            "modal-achievement", "modal-help-levelup", "btn-help-levelup-close",
            "menu-beginner-hint", "tutorial-count-explanation", "count-explain-text",
            "logo", "menu-logo-slot", "app-title", "menu-theme-label",
        ]
        for elem_id in required:
            with self.subTest(elem_id=elem_id):
                self.assertIn(f'id="{elem_id}"', html)

    def test_no_shoe_status_remove_bug(self) -> None:
        html = load_app_source()
        self.assertNotIn("shoe-status')?.remove()", html)
        self.assertNotIn('getElementById("shoe-status")?.remove()', html)

    def test_script_not_module(self) -> None:
        html = load_index_html()
        self.assertNotRegex(html, r'<script\s+type="module">')

    def test_live_index_deviations_wired(self) -> None:
        src = load_app_source()
        self.assertIn("useIndexDeviations", src)
        self.assertIn("formatStrategyHintText", src)
        self.assertIn('id="toggle-index-deviations"', src)
        self.assertIn("buildStratOpts", src)

    def test_pwa_manifest_and_shell(self) -> None:
        shell = load_index_html()
        root = ROOT
        self.assertTrue((root / "manifest.webmanifest").is_file())
        self.assertTrue((root / "sw.js").is_file())
        self.assertTrue((root / "icons" / "icon-192.png").is_file())
        self.assertIn('rel="manifest"', shell)
        self.assertIn('manifest.webmanifest', shell)
        self.assertIn('name="theme-color"', shell)
        self.assertIn('apple-mobile-web-app-capable', shell)
        self.assertIn("navigator.serviceWorker.register('sw.js')", shell)
        self.assertIn("!window.__CQ_TEST_MODE", shell)
        manifest = (root / "manifest.webmanifest").read_text(encoding="utf-8")
        self.assertIn('"display": "standalone"', manifest)
        self.assertIn("icons/icon-192.png", manifest)
        sw = (root / "sw.js").read_text(encoding="utf-8")
        self.assertIn("cq-pwa-v3", sw)
        self.assertIn("./css/tailwind.css", sw)
        self.assertNotIn("cdn.tailwindcss.com", sw)
        self.assertIn("./js/00-capacitor-bridge.js", sw)
        self.assertIn("./js/07-game-engine.js", sw)

    def test_tailwind_bundled_offline(self) -> None:
        shell = load_index_html()
        root = ROOT
        self.assertNotIn("cdn.tailwindcss.com", shell)
        self.assertNotIn("tailwind.config", shell)
        self.assertIn('href="css/tailwind.css"', shell)
        self.assertTrue((root / "css" / "tailwind.css").is_file())
        self.assertTrue((root / "css" / "tailwind-src.css").is_file())
        self.assertTrue((root / "tailwind.config.js").is_file())
        built = (root / "css" / "tailwind.css").read_text(encoding="utf-8")
        self.assertGreater(len(built), 10_000)
        for needle in (".text-gold", ".min-h-screen", ".flex", ".backdrop-blur"):
            self.assertIn(needle, built, f"missing utility {needle}")

    def test_native_brand_icons(self) -> None:
        root = ROOT
        bg = (root / "android" / "app" / "src" / "main" / "res" / "values" / "ic_launcher_background.xml").read_text(
            encoding="utf-8"
        )
        self.assertIn("#0a1612", bg)
        launcher = root / "android" / "app" / "src" / "main" / "res" / "mipmap-xxxhdpi" / "ic_launcher.png"
        self.assertTrue(launcher.is_file())
        self.assertGreater(launcher.stat().st_size, 500)
        splash = root / "android" / "app" / "src" / "main" / "res" / "drawable" / "splash.png"
        self.assertTrue(splash.is_file())
        ios_icon = root / "ios" / "App" / "App" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-512@2x.png"
        self.assertTrue(ios_icon.is_file())
        self.assertGreater(ios_icon.stat().st_size, 5000)
        self.assertTrue((root / "scripts" / "generate_native_icons.py").is_file())
        self.assertTrue((root / "scripts" / "cq_brand_icon.py").is_file())

    def test_android_release_signing_scaffold(self) -> None:
        root = ROOT
        example = root / "android" / "keystore.properties.example"
        self.assertTrue(example.is_file())
        text = example.read_text(encoding="utf-8")
        for key in ("storeFile", "storePassword", "keyPassword", "keyAlias"):
            self.assertIn(f"{key}=", text, f"missing {key} in keystore.properties.example")
        self.assertIn("countquest", text)
        gradle = (root / "android" / "app" / "build.gradle").read_text(encoding="utf-8")
        self.assertIn("keystore.properties", gradle)
        self.assertIn("signingConfigs", gradle)
        self.assertIn("signingConfig signingConfigs.release", gradle)
        self.assertTrue((root / "scripts" / "android_release_build.py").is_file())
        pkg = (root / "package.json").read_text(encoding="utf-8")
        self.assertIn("build:android:release", pkg)
        gitignore = (root / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("keystore.properties", gitignore)
        self.assertIn("*.keystore", gitignore)

    def test_capacitor_scaffold(self) -> None:
        root = ROOT
        shell = load_index_html()
        self.assertTrue((root / "capacitor.config.json").is_file())
        self.assertTrue((root / "scripts" / "stage_dist.py").is_file())
        self.assertTrue((root / "js" / "00-capacitor-bridge.js").is_file())
        self.assertIn('src="js/00-capacitor-bridge.js"', shell)
        self.assertIn("!window.__CQ_NATIVE", shell)
        cfg = (root / "capacitor.config.json").read_text(encoding="utf-8")
        self.assertIn('"webDir": "dist"', cfg)
        self.assertIn("com.countquest.blackjack", cfg)
        pkg = (root / "package.json").read_text(encoding="utf-8")
        self.assertIn("@capacitor/core", pkg)
        self.assertIn("@capacitor/android", pkg)
        self.assertIn("@capacitor/ios", pkg)
        self.assertTrue((root / "android").is_dir(), "run scripts/setup_capacitor.py")
        self.assertTrue((root / "ios").is_dir(), "run scripts/setup_capacitor.py")
        bridge = (root / "js" / "00-capacitor-bridge.js").read_text(encoding="utf-8")
        self.assertIn("__CQ_NATIVE", bridge)

    def test_modular_file_layout(self) -> None:
        shell = load_index_html()
        self.assertIn('href="css/tailwind.css"', shell)
        self.assertIn('href="css/app.css"', shell)
        for name in JS_MODULES:
            with self.subTest(module=name):
                self.assertIn(f'src="js/{name}"', shell)
                self.assertTrue((ROOT / "js" / name).is_file(), f"missing js/{name}")
        self.assertTrue((ROOT / "css" / "app.css").is_file())

    def test_unified_casino_table_layout(self) -> None:
        html = load_app_source()
        self.assertIn("casino-play-shell", html)
        self.assertIn("casino-seat-spot", html)
        self.assertIn("syncCasinoShellMetrics", html)
        self.assertIn("renderCasinoSeats", html)
        self.assertIn("casino-play-active", html)
        self.assertIn("casino-felt-bet-rail", html)
        self.assertIn("casino-felt-bet-panel", html)
        self.assertIn("casino-bet-active", html)
        self.assertIn("help.showCountInPlay()", html)
        self.assertIn("help.showCountAtTable()", html)
        self.assertIn("help.showPerCardCount()", html)
        self.assertIn("help.shouldShowHint(", html)
        self.assertIn("help.showBetSuggestion()", html)
        seat_markers = html.count('class="casino-seat')
        self.assertGreaterEqual(seat_markers, 7)

    def test_casino_layout_css_contract(self) -> None:
        """Structural scroll-free layout contract (no browser)."""
        html = load_app_source()
        self.assertIn("overflow: hidden", html)
        self.assertIn("html.casino-play-active", html)
        self.assertIn("--cq-header-h", html)
        self.assertIn("--cq-action-bar-h", html)
        self.assertIn("--cq-seat-spot-size", html)
        self.assertIn("--cq-seat-col-h", html)
        self.assertIn("--cq-topbar-max", html)
        self.assertIn("--cq-felt-deep", html)
        self.assertIn("--cq-gold-glow", html)
        self.assertIn("--cq-cyan-glow", html)
        self.assertIn('data-seat-count="7"', html)
        self.assertIn('data-seat="4"', html)
        self.assertIn("casino-seat-ai-ready", html)
        self.assertIn("casino-seat-cards-mount", html)
        self.assertIn("data-ai-slot", html)
        self.assertIn("grid-template-rows: var(--cq-seat-spot-size)", html)
        self.assertIn("viewport.style.transform = ''", html)
        self.assertNotRegex(html, r'class="[^"]*casino-seat-badge')
        self.assertNotRegex(html, r'class="[^"]*casino-seat-spot-active')
        self.assertNotIn("equalizeCasinoSeatGeometry()", html)
        self.assertNotRegex(html, r"casino-table-viewport[^}]*transform:\s*scale")
        def spot_before_label(seat_html: str) -> None:
            self.assertIn("casino-seat-spot", seat_html)
            self.assertIn("casino-seat-label", seat_html)
            self.assertLess(
                seat_html.index("casino-seat-spot"),
                seat_html.index("casino-seat-label"),
            )

        grid_start = html.index('id="casino-seat-grid"')
        grid_end = html.index('id="result-toast"', grid_start)
        grid_html = html[grid_start:grid_end]
        for seat_id in range(1, 8):
            marker = f'id="casino-seat-{seat_id}"' if seat_id != 4 else 'id="casino-seat-human"'
            start = grid_html.index(marker)
            next_markers = [
                grid_html.index(f'id="casino-seat-{n}"', start + 1)
                for n in range(1, 8)
                if n != seat_id and f'id="casino-seat-{n}"' in grid_html[start + 1 :]
            ]
            human_next = grid_html.find('id="casino-seat-human"', start + 1)
            if human_next > start and seat_id != 4:
                next_markers.append(human_next)
            end = min(next_markers) if next_markers else len(grid_html)
            spot_before_label(grid_html[start:end])
        self.assertIn("casino-seat-cards-mount", grid_html)
        label_count = len(re.findall(r'class="casino-seat-label', grid_html))
        self.assertEqual(label_count, 7)
        spot_count = len(re.findall(r'class="casino-seat-spot', grid_html))
        self.assertEqual(spot_count, 7)
        self.assertIn("casino-seat-ai", html)
        self.assertIn("createTableAiSeats", html)

    def test_casino_scroll_budget_at_720(self) -> None:
        """Static chrome + content budget at 1280x720 — values parsed from shipped CSS."""
        html = load_app_source()

        def rem(css: str, prop: str) -> float:
            m = re.search(rf"{re.escape(prop)}:\s*([\d.]+)rem", css)
            self.assertIsNotNone(m, f"missing {prop} in CSS")
            return float(m.group(1)) * 16.0

        compact = re.search(
            r"@media \(min-width: 1280px\) and \(max-height: 799px\)\s*\{([\s\S]*?)\n    \}\n",
            html,
        )
        self.assertIsNotNone(compact, "720p compact media block")
        c = compact.group(1)
        header = rem(c, "--cq-header-h")
        topbar = rem(c, "--cq-topbar-max")
        seat_col = rem(c, "--cq-seat-col-h")
        action_play = rem(c, "--cq-action-bar-h")
        dealer_m = re.search(
            r"\.casino-dealer-zone \.playing-card\s*\{[^}]*height:\s*([\d.]+)rem",
            c,
        )
        self.assertIsNotNone(dealer_m, "dealer card height in 720p block")
        dealer_card = float(dealer_m.group(1)) * 16.0
        chip_m = re.search(
            r"\.casino-felt-bet-panel \.bet-chip\s*\{[^}]*min-height:\s*([\d.]+)rem",
            c,
        )
        self.assertIsNotNone(chip_m, "bet chip min-height in 720p block")
        bet_chip = float(chip_m.group(1)) * 16.0

        shell_m = re.search(r"\.casino-play-shell\s*\{[^}]*padding:\s*([\d.]+)rem", html)
        shell_pad = float(shell_m.group(1)) * 16 if shell_m else 2.4
        surface_m = re.search(
            r"\.casino-table-surface\s*\{[^}]*padding:\s*([\d.]+)rem\s+([\d.]+)rem\s+([\d.]+)rem",
            html,
        )
        surface_pad = (float(surface_m.group(1)) + float(surface_m.group(3))) * 16 if surface_m else 10.4
        dealer_zone_m = re.search(
            r"\.casino-dealer-zone\s*\{[^}]*padding:\s*([\d.]+)rem\s+0\s+([\d.]+)rem",
            c,
        )
        dealer_pad = (float(dealer_zone_m.group(1)) + float(dealer_zone_m.group(2))) * 16 if dealer_zone_m else 2.4
        dealer_margin_m = re.search(r"\.casino-dealer-zone\s*\{[^}]*margin-bottom:\s*([\d.]+)rem", c)
        dealer_margin = float(dealer_margin_m.group(1)) * 16 if dealer_margin_m else 1.6
        bet_rail_m = re.search(
            r"\.casino-felt-bet-rail\s*\{[^}]*padding:\s*([\d.]+)rem",
            c,
        )
        bet_rail_pad = float(bet_rail_m.group(1)) * 16 * 2 if bet_rail_m else 6.4
        bet_rail_margin_m = re.search(
            r"\.casino-felt-bet-rail\s*\{[^}]*margin:\s*([\d.]+)rem\s+[\d.]+rem\s+([\d.]+)rem",
            c,
        )
        bet_rail_margin = (
            (float(bet_rail_margin_m.group(1)) + float(bet_rail_margin_m.group(2))) * 16
            if bet_rail_margin_m
            else 3.2
        )
        action_bet_m = re.search(
            r"body\.casino-play-active:not\(\.casino-action-bar-visible\)\s*\{\s*--cq-action-bar-h:\s*([\d.]+)rem",
            html,
        )
        action_bet = float(action_bet_m.group(1)) * 16 if action_bet_m else 8.0

        viewport = 720.0
        bet_shell = viewport - header - action_bet
        bet_stack = (
            shell_pad + topbar + surface_pad + dealer_pad + dealer_margin
            + dealer_card + bet_rail_margin + bet_rail_pad + bet_chip + seat_col
        )
        play_shell = viewport - header - action_play
        play_stack = shell_pad + topbar + surface_pad + dealer_pad + dealer_margin + dealer_card + seat_col
        self.assertLessEqual(bet_stack, bet_shell, f"bet stack {bet_stack:.1f} vs shell {bet_shell:.1f}")
        self.assertLessEqual(play_stack, play_shell, f"play stack {play_stack:.1f} vs shell {play_shell:.1f}")

    @unittest.skipUnless(
        os.environ.get("CQ_LAYOUT_PROBE"),
        "Playwright layout probe is optional; set CQ_LAYOUT_PROBE=1 to run",
    )
    def test_table_layout_playwright_check(self) -> None:
        """Optional end-to-end layout probe at 1280x720 (not gating)."""
        proc = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "table_layout_check.py")],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=60,
        )
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        self.assertIn("PASS", proc.stdout)

    def test_full_width_layout_no_split_panel(self) -> None:
        """Game UI must not reserve a permanent right-hand stats column (todo 1.3)."""
        html = load_app_source()
        layout_ids = ("app-header", "app-main", "action-bar", "stats-sidebar")
        for elem_id in layout_ids:
            m = re.search(rf'id="{elem_id}"[^>]*class="([^"]*)"', html)
            self.assertIsNotNone(m, f"missing #{elem_id}")
            classes = m.group(1)
            with self.subTest(elem_id=elem_id):
                self.assertNotIn("lg:mr-80", classes)
                self.assertNotIn("lg:translate-x-0", classes)
        self.assertNotRegex(html, r"@media\s*\(\s*min-width:\s*1024px\s*\)[^{]*\{[^}]*margin-right:\s*20rem")
        self.assertIn('id="stats-backdrop"', html)
        self.assertIn('id="btn-menu-stats"', html)
        self.assertIn("game-table-wrap", html)
        self.assertIn('id="screen-casino-play"', html)
        self.assertIn('id="casino-seat-grid"', html)
        self.assertIn('data-seat-count="7"', html)
        self.assertIn('id="casino-seat-human"', html)
        self.assertIn('data-seat="4"', html)
        self.assertIn('id="screen-table" class="game-screen max-w-6xl', html)
        self.assertIn("--cq-felt-deep", html)
        self.assertIn("--cq-gold", html)
        self.assertIn("--cq-cyan-glow", html)
        self.assertIn("toggleStatsSidebar", html)
        self.assertIn("body.stats-open", html)

    def test_training_mode_present(self) -> None:
        html = load_app_source()
        self.assertIn("const TRAINING_DRILLS = [", html)
        self.assertIn("openTrainingMode", html)
        self.assertIn("launchTrainingDrill", html)
        self.assertIn("Training Mode", html)
        self.assertIn("launch: 'card-bursts'", html)
        self.assertIn("launch: 'decks-left'", html)

    def test_true_count_drill_present(self) -> None:
        html = load_app_source()
        self.assertIn("generateTrueCountProblem", html)
        self.assertIn("openTrueCountDrill", html)
        self.assertIn("TC_DRILL_DIFFICULTIES", html)
        self.assertIn("True Count Conversion Drill", html)
        self.assertIn("launch: 'true-count'", html)

    def test_speed_drill_present(self) -> None:
        html = load_app_source()
        self.assertIn("count-speed", html)
        self.assertIn("Running Count Speed Drill", html)
        self.assertIn("function summarizeSpeedDrillHistory", html)
        self.assertIn("function recordSpeedDrillSession", html)
        self.assertIn("openSpeedDrill", html)
        self.assertIn("SPEED_DRILL_MS", html)

    def test_combined_practice_present(self) -> None:
        html = load_app_source()
        self.assertIn("Combined Practice", html)
        self.assertIn("launch: 'combined'", html)
        self.assertIn("drill-combined", html)
        self.assertIn("function summarizeCombinedPracticeVisit", html)
        self.assertIn("function recordCombinedPracticeSession", html)
        self.assertIn("finishCombinedPracticeSession", html)
        self.assertIn("formatCombinedHandReview", html)

    def test_bet_spread_drill_present(self) -> None:
        html = load_app_source()
        self.assertIn("Bet Spread Practice", html)
        self.assertIn("launch: 'bet-spread'", html)
        self.assertIn("openBetSpreadDrill", html)
        self.assertIn("screen-drill-bet-spread", html)
        self.assertIn("betSpreadUnitsFromTrueCountWithMax", html)
        self.assertIn("summarizeBetSpreadRounds", html)
        self.assertIn("kellyBetUnitsFromTrueCount", html)
        self.assertIn("detectBetSpreadHeat", html)
        self.assertIn("renderBetSpreadSessionChartHtml", html)
        self.assertIn("bet-spread-system", html)
        self.assertIn("bet-spread-custom-range", html)

    def test_index_play_drill_present(self) -> None:
        html = load_app_source()
        self.assertIn("INDEX_PLAY_CATALOG", html)
        self.assertIn("openIndexPlayDrill", html)
        self.assertIn("screen-drill-index", html)
        self.assertIn("getIndexPlayCorrectAction", html)
        self.assertIn("launch: 'index-plays'", html)
        self.assertIn("Index Play Drill", html)

    def test_training_history_present(self) -> None:
        html = load_app_source()
        self.assertIn("screen-training-history", html)
        self.assertIn("function recordTrainingHistorySession", html)
        self.assertIn("function summarizeTrainingHistoryTrend", html)
        self.assertIn("openTrainingHistory", html)
        self.assertIn("btn-training-history", html)
        self.assertIn("trainingHistory", html)

    def test_mistake_review_present(self) -> None:
        html = load_app_source()
        self.assertIn("screen-training-mistakes", html)
        self.assertIn("function recordMistakeReviewEntry", html)
        self.assertIn("function getMistakeReviewEntries", html)
        self.assertIn("function summarizeMistakeReview", html)
        self.assertIn("openMistakeReview", html)
        self.assertIn("btn-training-mistakes", html)
        self.assertIn("mistakeReviewLog", html)
        self.assertIn("renderMistakeReview", html)

    def test_drill_session_summary_present(self) -> None:
        html = load_app_source()
        self.assertIn("screen-drill-session-summary", html)
        self.assertIn("function buildDrillSessionSummary", html)
        self.assertIn("function renderDrillSessionSummaryHtml", html)
        self.assertIn("function updateDrillPersonalBest", html)
        self.assertIn("function formatDurationMs", html)
        self.assertIn("finishDrillWithSummary", html)
        self.assertIn("drillSessionBests", html)
        self.assertIn("btn-drill-summary-retry", html)

    def test_daily_training_goals_present(self) -> None:
        html = load_app_source()
        self.assertIn("DAILY_TRAINING_GOAL_TYPES", html)
        self.assertIn("function dailyTrainingGoalForDate", html)
        self.assertIn("function evaluateDailyTrainingProgress", html)
        self.assertIn("function ensureDailyTrainingCurrent", html)
        self.assertIn("daily-training-panel", html)
        self.assertIn("training-daily-goal", html)
        self.assertIn("checkDailyTrainingProgress", html)
        self.assertIn("completeDailyTraining", html)
        self.assertIn("dailyTraining", html)
        self.assertIn("DAILY_TRAINING_SYNERGY_BONUS", html)

    def test_dual_currency_tables_present(self) -> None:
        html = load_app_source()
        self.assertIn("const TABLE_TIERS = [", html)
        self.assertIn("TABLE_WIN_MULTIPLIER", html)
        self.assertIn("function syncWalletSave", html)
        self.assertIn("function payTableEntry", html)
        self.assertIn("function settleTableSession", html)
        self.assertIn("function canJoinTable", html)
        self.assertIn("screen-table-lobby", html)
        self.assertIn("menu-currency-bar", html)
        self.assertIn("header-currency", html)
        self.assertIn("openTableLobby", html)
        self.assertIn("renderTableLobby", html)
        self.assertIn("joinTable", html)
        self.assertIn("settleTableSessionIfNeeded", html)
        self.assertIn("renderCurrencyDisplays", html)
        self.assertIn("SAVE_VERSION = 18", html)
        self.assertIn("Play Tables", html)
        self.assertIn("entryFeeChips: 50", html)
        self.assertIn("entryFeeGems: 1", html)

    def test_clubs_present(self) -> None:
        html = load_app_source()
        self.assertIn("CLUBS_REGISTRY_KEY", html)
        self.assertIn("CLUB_MAX_MEMBERS", html)
        self.assertIn("function createClub", html)
        self.assertIn("function joinClub", html)
        self.assertIn("function leaveClub", html)
        self.assertIn("function searchClubs", html)
        self.assertIn("const ClubsRegistry", html)
        self.assertIn("screen-clubs", html)
        self.assertIn("openClubs", html)
        self.assertIn("renderClubMemberList", html)
        self.assertIn("Counting Crews", html)
        self.assertIn("club-create-name", html)
        self.assertIn("data-join-club", html)

    def test_club_hierarchy_present(self) -> None:
        html = load_app_source()
        self.assertIn("CLUB_ROLE_LABELS", html)
        self.assertIn("CLUB_PERMISSIONS", html)
        self.assertIn("function normalizeClubRole", html)
        self.assertIn("function hasClubPermission", html)
        self.assertIn("function promoteClubMember", html)
        self.assertIn("function demoteClubMember", html)
        self.assertIn("function kickClubMember", html)
        self.assertIn("function transferClubLeadership", html)
        self.assertIn("function updateClubInfo", html)
        self.assertIn("clubs-edit-view", html)
        self.assertIn("data-club-promote", html)
        self.assertIn("data-club-kick", html)
        self.assertIn("clubManageAction", html)
        self.assertIn("showClubEditForm", html)
        self.assertIn("role: 'leader'", html)

    def test_club_hub_present(self) -> None:
        html = load_app_source()
        self.assertIn("clubs-hub-view", html)
        self.assertIn("club-hub-chat", html)
        self.assertIn("club-hub-leaderboard", html)
        self.assertIn("club-hub-announcements", html)
        self.assertIn("function recordClubWeeklyActivity", html)
        self.assertIn("function postClubChatMessage", html)
        self.assertIn("function reactClubChatMessage", html)
        self.assertIn("function postClubAnnouncement", html)
        self.assertIn("function setClubWeeklyChallenge", html)
        self.assertIn("function getClubWeeklyLeaderboard", html)
        self.assertIn("renderClubHub", html)
        self.assertIn("CLUB_WEEKLY_POINT_RULES", html)
        self.assertIn("data-club-react", html)

    def test_daily_rewards_present(self) -> None:
        html = load_app_source()
        self.assertIn("DAILY_LOGIN_REWARD_TABLE", html)
        self.assertIn("function defaultDailyRewards", html)
        self.assertIn("function ensureDailyRewardsCurrent", html)
        self.assertIn("function claimDailyLoginReward", html)
        self.assertIn("function connectSocialAccount", html)
        self.assertIn("SOCIAL_CONNECT_CHIP_BONUS", html)
        self.assertIn("screen-daily-rewards", html)
        self.assertIn("modal-daily-reward", html)
        self.assertIn("openDailyRewards", html)
        self.assertIn("daily-login-reward-panel", html)
        self.assertIn("dailyRewards", html)
        self.assertIn("login-streak-7", html)

    def test_card_burst_drill_present(self) -> None:
        html = load_app_source()
        self.assertIn("screen-drill-card-burst", html)
        self.assertIn("openCardBurstDrill", html)
        self.assertIn("startCardBurstRound", html)
        self.assertIn("launch: 'card-bursts'", html)
        self.assertIn("status: 'live', launch: 'card-bursts'", html)

    def test_decks_left_drill_present(self) -> None:
        html = load_app_source()
        self.assertIn("screen-drill-decks-left", html)
        self.assertIn("openDecksLeftDrill", html)
        self.assertIn("generateDecksLeftProblem", html)
        self.assertIn("launch: 'decks-left'", html)

    def test_dealer_night_event_present(self) -> None:
        html = load_app_source()
        self.assertIn("id: 'dealer-night'", html)
        self.assertIn("eventType: 'dealer'", html)
        self.assertIn("joinSpecialEventDealerShift", html)
        self.assertIn("submitDealerInsurancePayout", html)
        self.assertIn("DEALER_INSURANCE_OPTIONS", html)

    def test_dealer_mode_present(self) -> None:
        html = load_app_source()
        self.assertIn("const DEALER_MODE =", html)
        self.assertIn("function createDealerAISeats", html)
        self.assertIn("function validateDealerPayoutGuess", html)
        self.assertIn("function dealerActionPrompt", html)
        self.assertIn("function computeDealerShiftReward", html)
        self.assertIn("function dealerUpShowsPeek", html)
        self.assertIn("dealerAISplitHand", html)
        self.assertIn("finishDrillWithSummary('dealer-mode'", html)
        self.assertIn("screen-dealer-mode", html)
        self.assertIn("openDealerMode", html)
        self.assertIn("startDealerShift", html)
        self.assertIn("submitDealerPayout", html)
        self.assertIn("dealer-mode", html)
        self.assertIn("id: 'dealer-mode'", html)
        self.assertIn("id: 'dealer'", html)
        self.assertIn("action: 'dealer-mode'", html)
        self.assertIn("defaultDealerModeStats", html)
        self.assertIn("dealerMode", html)
        self.assertIn("drillId: 'dealer-mode'", html)
        self.assertIn("dealer-shift", html)

    def test_polish_pass_present(self) -> None:
        html = load_app_source()
        self.assertIn("heroGlow", html)
        self.assertIn("passShimmer", html)
        self.assertIn("function lobbyTapFeedback", html)
        self.assertIn("function showModalPremium", html)
        self.assertIn("function bumpCurrencyEl", html)
        self.assertIn("screen-enter", html)
        self.assertIn("dialog-premium", html)
        self.assertIn("currency-bump", html)
        self.assertIn("lobby-continue-btn", html)
        self.assertIn("prefers-reduced-motion", html)
        self.assertIn("case 'tap':", html)
        self.assertIn("case 'whoosh':", html)
        self.assertIn("case 'reward':", html)
        self.assertIn("case 'sparkle':", html)
        self.assertIn("PHASE_SCREEN_IDS", html)

    def test_special_events_present(self) -> None:
        html = load_app_source()
        self.assertIn("const SPECIAL_EVENTS = [", html)
        self.assertIn("function getCurrentSpecialEvent", html)
        self.assertIn("function getSpecialEventTier", html)
        self.assertIn("function getGlobalCrewLeaderboard", html)
        self.assertIn("function ensureSpecialEventProgress", html)
        self.assertIn("screen-special-event", html)
        self.assertIn("openSpecialEvent", html)
        self.assertIn("joinSpecialEventTable", html)
        self.assertIn("renderSpecialEvent", html)
        self.assertIn("specialEvent", html)
        self.assertIn("action: 'special-event'", html)

    def test_tournament_brackets_present(self) -> None:
        html = load_app_source()
        self.assertIn("TOURNAMENT_BRACKET_SIZE", html)
        self.assertIn("screen-tournament", html)
        self.assertIn("tournament-bracket-tree", html)
        self.assertIn("openTournament", html)
        self.assertIn("startTournament", html)
        self.assertIn("resolveTournamentMatch", html)
        self.assertIn("createTournamentBracket", html)
        self.assertIn("canEnterTournament", html)
        self.assertIn("buildClubInviteUrl", html)
        self.assertIn("handleInviteDeepLink", html)
        self.assertIn("buildTournamentInviteUrl", html)
        self.assertIn("handleTournamentInviteDeepLink", html)
        self.assertIn("handleDeepLinks", html)
        self.assertIn("TournamentInviteRegistry", html)
        self.assertIn("btn-tournament-invite", html)
        self.assertIn("defaultTournament", html)

    def test_plan21_lobby_present(self) -> None:
        html = load_app_source()
        self.assertIn("LOBBY_NAV_ITEMS", html)
        self.assertIn("LOBBY_PLAY_MODES", html)
        self.assertIn("LOBBY_MINIGAMES", html)
        self.assertIn("LOBBY_HERO_PLAY", html)
        self.assertIn("lobby-8bp", html)
        self.assertIn("lobby-clubs-btn", html)
        self.assertIn("lobby-hero-play", html)
        self.assertIn("lobby-bottom-dock", html)
        self.assertIn("lobby-xp-bar", html)
        self.assertIn("lobby-currency-buy", html)
        self.assertIn("startLobbyPassTimer", html)
        self.assertIn("lobby-spin-wheel", html)
        self.assertIn("lobby-top-nav", html)
        self.assertIn("lobby-play-grid", html)
        self.assertIn("lobby-minigames-row", html)
        self.assertIn("lobby-pass-banner", html)
        self.assertIn("renderLobby", html)
        self.assertIn("handleLobbyNav", html)
        self.assertIn("handleLobbyCurrencyBuy", html)
        self.assertIn("modal-lobby-shop", html)
        self.assertIn("modal-lobby-leaderboards", html)
        self.assertIn("modal-lobby-minigame", html)
        self.assertIn("lobbyMinigames", html)
        self.assertIn("CountQuest Pass", html)

    def test_club_economy_present(self) -> None:
        html = load_app_source()
        self.assertIn("CLUB_WEEKLY_TOP3_PAYOUTS", html)
        self.assertIn("function contributeToClubBankroll", html)
        self.assertIn("function distributeClubBankroll", html)
        self.assertIn("function joinClubByInviteCode", html)
        self.assertIn("function regenerateClubInviteCode", html)
        self.assertIn("function processWeeklyTop3Payouts", html)
        self.assertIn("club-hub-bankroll", html)
        self.assertIn("club-hub-invite", html)
        self.assertIn("club-invite-join-input", html)
        self.assertIn("generateClubInviteCode", html)

    def test_external_oauth_iap_present(self) -> None:
        html = load_app_source()
        self.assertIn("const ExternalAuth =", html)
        self.assertIn("const ExternalIAP =", html)
        self.assertIn("loadExternalConfig", html)
        self.assertIn("saveExternalConfig", html)
        self.assertIn("cfg-google-client-id", html)
        self.assertIn("cfg-facebook-app-id", html)
        self.assertIn("cfg-stripe-vip-link", html)
        self.assertIn("btn-save-external-config", html)
        self.assertIn("vip_purchased", html)

    def test_vip_pass_present(self) -> None:
        html = load_app_source()
        self.assertIn("function defaultVipPass", html)
        self.assertIn("function isVipActive", html)
        self.assertIn("function purchaseVipPass", html)
        self.assertIn("function claimVipTrial", html)
        self.assertIn("function vipTableWinBonus", html)
        self.assertIn("VIP_PASS_COST_GEMS", html)
        self.assertIn("VIP_CHIP_MULTIPLIER", html)
        self.assertIn("daily-rewards-vip", html)
        self.assertIn("vip-member", html)
        self.assertIn("purchaseVipPassAction", html)


if __name__ == "__main__":
    print("Running CountQuest web logic tests...\n")
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestWebLogicParity))
    suite.addTests(loader.loadTestsFromTestCase(TestWebLogicHard))
    suite.addTests(loader.loadTestsFromTestCase(TestIndexHtmlStructure))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)