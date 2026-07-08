"""Playwright probe for wide short viewports (e.g. 1966x709)."""
from __future__ import annotations

import http.server
import json
import socket
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

VIS_HELPER = """
() => {
  const M = 6;
  const probe = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { exists: false };
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || el.classList.contains('hidden'))
      return { exists: true, visible: false };
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight, vw = window.innerWidth;
    const fullWidthBar = sel === '#action-bar';
    const inViewport = r.width > 2 && r.height > 2 && r.top >= M
      && (fullWidthBar ? r.left >= 0 : r.left >= M)
      && r.bottom <= (fullWidthBar ? vh + 0.5 : vh - M)
      && (fullWidthBar ? r.right <= vw + 0.5 : r.right <= vw - M);
    return { exists: true, visible: r.width > 2 && r.height > 2, inViewport,
      rect: { top: r.top, bottom: r.bottom, h: r.height } };
  };
  const cardClip = (card) => {
    const r = card.getBoundingClientRect();
    const wrap = card.closest('.casino-seat-cards-wrap') || card.parentElement;
    const wr = wrap?.getBoundingClientRect();
    if (!wr) return false;
    return r.bottom > wr.bottom + 1 || r.top < wr.top - 1;
  };
  const cards = [...document.querySelectorAll('#player-hands .playing-card')];
  const dealerCards = [...document.querySelectorAll('#dealer-cards .playing-card')];
  const zone = document.querySelector('.casino-dealer-zone')?.getBoundingClientRect();
  return {
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    phase: window.app?.phase,
    countHud: probe('#count-hud'),
    countHudBet: probe('#count-hud-bet'),
    strategyHint: probe('#strategy-hint'),
    shoeStatus: probe('#shoe-status'),
    actionBar: probe('#action-bar'),
    humanSeat: probe('#casino-seat-human'),
    feltBetRail: probe('#casino-felt-bet-rail'),
    cardClippedInWrap: cards.some(cardClip),
    dealerCardClipped: dealerCards.some(c => {
      const r = c.getBoundingClientRect();
      return zone && (r.bottom > zone.bottom + 1);
    }),
    playerCardCount: cards.length,
    humanSeatH: document.getElementById('casino-seat-human')?.getBoundingClientRect().height,
    wrapH: document.getElementById('player-hands')?.getBoundingClientRect().height,
    headerH: document.getElementById('app-header')?.getBoundingClientRect().height,
    topbarH: document.querySelector('.casino-table-topbar')?.getBoundingClientRect().height,
  };
}
"""

START_BET = """
() => {
  const a = window.app;
  a.save.stats.helpLevel = 0;
  a.stats.helpLevel = 0;
  a.save.settings.practiceMode = true;
  a.startSession(true, 'practice-range');
  a.syncCasinoShellMetrics();
  return { phase: a.phase };
}
"""


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run_probe(width: int, height: int) -> dict:
    import time

    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": width, "height": height})
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=45000)
            page.wait_for_function("() => !!window.app", timeout=90000)
            page.evaluate(START_BET)
            page.wait_for_function("() => window.app.phase === 'bet'", timeout=10000)
            page.evaluate("() => window.app.syncCasinoShellMetrics()")
            bet = page.evaluate(VIS_HELPER)
            page.click("#chip-buttons .bet-chip")
            page.click("#btn-deal")
            page.wait_for_function(
                "() => window.app.phase === 'playing' && !window.app.dealing "
                "&& document.querySelectorAll('#player-hands .playing-card').length >= 2 "
                "&& document.querySelectorAll('#dealer-cards .playing-card').length >= 2",
                timeout=25000,
            )
            page.evaluate("() => window.app.syncCasinoShellMetrics()")
            time.sleep(0.35)
            playing = page.evaluate(VIS_HELPER)
            browser.close()
        return {
            "viewport": f"{width}x{height}",
            "bet": bet,
            "playing": playing,
            "checks": {
                "no_scroll_bet": bet["scrollHeight"] <= bet["innerHeight"],
                "no_scroll_playing": playing["scrollHeight"] <= playing["innerHeight"],
                "no_card_clip_playing": not playing["cardClippedInWrap"],
                "no_dealer_clip": not playing["dealerCardClipped"],
                "count_hud_playing": playing["countHud"].get("inViewport"),
                "action_bar_playing": playing["actionBar"].get("inViewport"),
                "shoe_status_visible": playing["shoeStatus"].get("visible")
                and (playing["shoeStatus"].get("rect", {}).get("h", 0) or 0) > 4,
                "strategy_hint_visible": playing["strategyHint"].get("visible")
                and (playing["strategyHint"].get("rect", {}).get("h", 0) or 0) > 4,
            },
        }
    finally:
        httpd.shutdown()


def main() -> int:
    results = []
    for w, h in [(1966, 709), (1280, 720)]:
        results.append(run_probe(w, h))
    print(json.dumps(results, indent=2))
    failed = [r for r in results if not all(r["checks"].values())]
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())