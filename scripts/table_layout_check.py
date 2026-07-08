"""Playwright: unified casino table at 1280x720 — startSession + click bet/deal."""
from __future__ import annotations

import argparse
import http.server
import json
import socket
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCRATCH = Path(r"C:\Users\User\AppData\Local\Temp\grok-goal-eee21b6742af\implementer")
VIEW_MARGIN = 6


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


VIS_HELPER = f"""
() => {{
  const M = {VIEW_MARGIN};
  const probe = (sel) => {{
    const el = document.querySelector(sel);
    if (!el) return {{ exists: false }};
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || el.classList.contains('hidden')) {{
      return {{ exists: true, visible: false, reason: 'hidden-class-or-style' }};
    }}
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const fullWidthBar = sel === '#action-bar';
    const inViewport = r.width > 2 && r.height > 2
      && r.top >= M
      && (fullWidthBar ? r.left >= 0 : r.left >= M)
      && r.bottom <= (fullWidthBar ? vh + 0.5 : vh - M)
      && (fullWidthBar ? r.right <= vw + 0.5 : r.right <= vw - M);
    return {{
      exists: true,
      visible: r.width > 2 && r.height > 2,
      inViewport,
      rect: {{ top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }},
    }};
  }};
  const seats = [...document.querySelectorAll('#casino-seat-grid .casino-seat')];
  const heights = seats.map(s => s.getBoundingClientRect().height);
  const spots = [...document.querySelectorAll('.casino-seat-spot')];
  const spotHeights = spots.map(s => s.getBoundingClientRect().height);
  const humanH = document.getElementById('casino-seat-human')?.getBoundingClientRect().height || 0;
  const maxSeatH = heights.length ? Math.max(...heights) : 0;
  const minSeatH = heights.length ? Math.min(...heights) : 0;
  const maxSpotH = spotHeights.length ? Math.max(...spotHeights) : 0;
  const minSpotH = spotHeights.length ? Math.min(...spotHeights) : 0;
  const actionBar = document.getElementById('action-bar');
  const actionBarHidden = !actionBar || actionBar.classList.contains('hidden')
    || getComputedStyle(actionBar).display === 'none';
  return {{
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    seats: seats.length,
    spotCount: spots.length,
    minSeatH,
    maxSeatH,
    minSpotH,
    maxSpotH,
    humanSeatH: humanH,
    chipCount: document.querySelectorAll('#chip-buttons .bet-chip').length,
    dealerCards: document.querySelectorAll('#dealer-cards .playing-card').length,
    playerCards: document.querySelectorAll('#player-hands .playing-card').length,
    actionBtns: document.querySelectorAll('#action-buttons .action-btn').length,
    phase: window.app?.phase,
    countHudBet: probe('#count-hud-bet'),
    countHud: probe('#count-hud'),
    humanSeat: probe('#casino-seat-human'),
    humanSpot: probe('#casino-seat-human .casino-seat-spot'),
    feltBetRail: probe('#casino-felt-bet-rail'),
    feltSurface: probe('.casino-table-surface'),
    actionBar: probe('#action-bar'),
    actionBarHidden,
    btnDeal: probe('#btn-deal'),
    screenBet: probe('#screen-bet'),
    betOnFelt: !!document.getElementById('screen-bet')?.closest('.casino-table-surface'),
    spotHeightRatio: minSpotH > 0 ? maxSpotH / minSpotH : 99,
    seatHeightRatio: minSeatH > 0 ? humanH / minSeatH : 99,
    viewportTransform: getComputedStyle(document.querySelector('.casino-table-viewport') || document.body).transform,
  }};
}}
"""


START_BET_SESSION = """
() => {
  const a = window.app;
  a.save.stats.helpLevel = 0;
  a.stats.helpLevel = 0;
  a.save.settings.practiceMode = true;
  a.startSession(true, 'practice-range');
  a.syncCasinoShellMetrics();
  return { phase: a.phase, via: 'startSession', chips: document.querySelectorAll('#chip-buttons .bet-chip').length };
}
"""


def run_check(scratch: Path) -> dict:
    import os

    os.chdir(ROOT)
    scratch.mkdir(parents=True, exist_ok=True)
    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    errors: list[str] = []
    result: dict = {"ok": False}

    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.on("pageerror", lambda exc: errors.append(str(exc)))

            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=45000)
            page.wait_for_function("() => !!window.app", timeout=90000)

            bet_setup = page.evaluate(START_BET_SESSION)
            page.wait_for_function("() => window.app.phase === 'bet'", timeout=10000)
            time.sleep(0.2)
            page.evaluate("() => window.app.syncCasinoShellMetrics()")
            bet = page.evaluate(VIS_HELPER)
            page.screenshot(path=str(scratch / "table-layout-bet.png"))

            # User-simulation: click chip on felt rail, then Deal
            page.wait_for_selector("#chip-buttons .bet-chip", timeout=10000)
            page.click("#chip-buttons .bet-chip")
            time.sleep(0.15)
            page.click("#btn-deal")
            page.wait_for_function(
                "() => window.app.phase === 'playing' && document.querySelectorAll('#dealer-cards .playing-card').length >= 2",
                timeout=25000,
            )
            play_setup = page.evaluate("""() => ({
              phase: window.app.phase,
              via: 'click_chip_and_deal',
              dealerCards: window.app.dealer.cards.length,
              playerCards: window.app.playerHands[0]?.hand?.cards?.length || 0,
              actionBtns: document.querySelectorAll('#action-buttons .action-btn').length,
            })""")
            time.sleep(0.3)
            page.evaluate("() => window.app.syncCasinoShellMetrics()")
            playing = page.evaluate(VIS_HELPER)
            page.screenshot(path=str(scratch / "table-layout-playing.png"))
            page.screenshot(path=str(scratch / "table-layout.png"))

            browser.close()

        felt_h = bet.get("feltSurface", {}).get("rect", {}).get("h", 0)
        action_h_bet = bet.get("actionBar", {}).get("rect", {}).get("h", 0)

        checks = {
            "seats_7": bet["seats"] == 7,
            "spots_7": bet["spotCount"] == 7,
            "min_seat_height": bet["minSeatH"] >= 52,
            "min_spot_height": bet["minSpotH"] >= 44,
            "bet_on_felt": bet.get("betOnFelt") is True,
            "felt_bet_rail_visible": bet.get("feltBetRail", {}).get("inViewport") is True,
            "action_bar_hidden_bet": bet.get("actionBarHidden") is True,
            "felt_surface_tall_bet": felt_h >= 200,
            "spot_height_balance": bet.get("spotHeightRatio", 99) <= 1.15,
            "seat_height_balance": bet.get("seatHeightRatio", 99) <= 1.2,
            "no_transform_scale": bet.get("viewportTransform") in ("none", "matrix(1, 0, 0, 1, 0, 0)", ""),
            "no_scroll_bet": bet["scrollHeight"] <= bet["innerHeight"],
            "no_scroll_playing": playing["scrollHeight"] <= playing["innerHeight"],
            "bet_via_startSession": bet_setup.get("phase") == "bet",
            "play_via_clicks": play_setup.get("via") == "click_chip_and_deal" and play_setup.get("phase") == "playing",
            "bet_chips_rendered": bet["chipCount"] >= 2,
            "count_hud_bet_visible": bet["countHudBet"].get("inViewport"),
            "human_spot_visible": bet["humanSpot"].get("inViewport"),
            "btn_deal_visible": bet["btnDeal"].get("inViewport"),
            "dealer_cards_playing": playing["dealerCards"] >= 2,
            "player_cards_playing": playing["playerCards"] >= 2,
            "action_buttons_playing": playing["actionBtns"] >= 2,
            "action_bar_in_viewport": playing["actionBar"].get("inViewport"),
            "action_bar_compact_playing": playing.get("actionBar", {}).get("rect", {}).get("h", 999) <= 100,
            "count_hud_playing": playing["countHud"].get("inViewport"),
            "no_console_errors": not errors,
        }
        result = {
            "ok": all(checks.values()),
            "checks": checks,
            "bet_setup": bet_setup,
            "play_setup": play_setup,
            "bet": bet,
            "playing": playing,
            "console_errors": errors,
            "metrics": {
                "felt_surface_h_bet": felt_h,
                "action_bar_h_bet": action_h_bet,
                "action_bar_h_playing": playing.get("actionBar", {}).get("rect", {}).get("h", 0),
            },
        }
        (scratch / "table-layout-check.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result
    finally:
        httpd.shutdown()


def main() -> int:
    import os

    if not os.environ.get("CQ_LAYOUT_PROBE"):
        print("SKIP: table_layout_check (optional; set CQ_LAYOUT_PROBE=1 to run Playwright probe)")
        return 0
    parser = argparse.ArgumentParser()
    parser.add_argument("--scratch", type=Path, default=DEFAULT_SCRATCH)
    args = parser.parse_args()
    result = run_check(args.scratch)
    failed = [k for k, v in result.get("checks", {}).items() if not v]
    out = json.dumps({k: result["checks"][k] for k in sorted(result.get("checks", {}))}, indent=2)
    print(out)
    if failed:
        print("FAILED:", ", ".join(failed))
        if result.get("console_errors"):
            print("errors:", result["console_errors"][:3])
        return 1
    print("PASS — table layout check (click bet/deal on felt rail)")
    return 0


if __name__ == "__main__":
    sys.exit(main())