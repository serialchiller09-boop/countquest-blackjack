"""Verify 1280x720 layout with a wide split hand — no page or panel scrolling."""
from __future__ import annotations

import http.server
import json
import socket
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SETUP_SPLIT_WIDE = """
() => {
  const a = window.app;
  a.save.stats.helpLevel = 0;
  a.stats.helpLevel = 0;
  a.save.settings.practiceMode = true;
  a.startSession(true, 'practice-range');
  a.phase = 'playing';
  a.dealing = false;
  a.ensureShoe();
  const card = (r, s) => createPlayingCard(r, s || 'S');
  const mkHand = (ranks, bet) => ({
    hand: new Hand(ranks.map((r, i) => card(r, ['S', 'H', 'D', 'C'][i % 4]))),
    bet: bet || 25,
    finished: false,
    doubled: false,
    fromSplit: true,
    splitAces: false,
  });
  a.playerHands = [
    mkHand(['A', '2', '3', '4', '5', '6', '7'], 25),
    mkHand(['A', '2', '3', '4', '5', '6'], 25),
    mkHand(['8', '9', '10', '2', '3', '4'], 25),
    mkHand(['K', 'Q', 'J', '5', '6'], 25),
  ];
  a.activeIdx = 0;
  a.splitDone = true;
  a.dealer.clear();
  a.dealer.cards.push(card('6'), card('10'), card('2'), card('3'), card('4'), card('5'));
  a.hideHole = false;
  a.render();
  a.syncCasinoShellMetrics();
  return {
    phase: a.phase,
    splitN: a.playerHands.length,
    maxCards: Math.max(...a.playerHands.map(h => h.hand.cards.length)),
    handScale: getComputedStyle(document.getElementById('player-hands')).getPropertyValue('--cq-hand-scale').trim(),
  };
}
"""

SCROLL_AUDIT = """
() => {
  const pick = (el) => {
    if (!el) return null;
    const st = getComputedStyle(el);
    return {
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      hasHScroll: el.scrollWidth > el.clientWidth + 1,
      hasVScroll: el.scrollHeight > el.clientHeight + 1,
      overflowX: st.overflowX,
      overflowY: st.overflowY,
    };
  };
  const ids = [
    'html', 'body', 'main', '#screen-casino-play', '.casino-table-viewport',
    '.casino-table-surface', '#casino-seat-grid', '#casino-seat-human',
    '#player-hands', '#action-bar', '.casino-table-topbar',
  ];
  const elements = {};
  for (const sel of ids) {
    const el = sel === 'html' ? document.documentElement
      : sel === 'body' ? document.body
      : document.querySelector(sel);
    elements[sel] = pick(el);
  }
  const cards = [...document.querySelectorAll('#player-hands .playing-card')];
  const shell = document.getElementById('screen-casino-play')?.getBoundingClientRect();
  const grid = document.getElementById('casino-seat-grid')?.getBoundingClientRect();
  const cardOverflowShell = cards.filter(c => {
    const r = c.getBoundingClientRect();
    return shell && (r.right > shell.right + 3 || r.left < shell.left - 3);
  }).length;
  const cardOverflowGrid = cards.filter(c => {
    const r = c.getBoundingClientRect();
    return grid && (r.right > grid.right + 3 || r.left < grid.left - 3);
  }).length;
  const viewport = document.querySelector('.casino-table-viewport');
  return {
    phase: window.app?.phase,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    docScrollH: document.documentElement.scrollHeight,
    docScrollW: document.documentElement.scrollWidth,
    pageOverflowV: document.documentElement.scrollHeight > window.innerHeight + 1,
    pageOverflowH: document.documentElement.scrollWidth > window.innerWidth + 1,
    splitHands: document.querySelectorAll('#player-hands .casino-player-hand').length,
    playerCards: cards.length,
    handScale: getComputedStyle(document.getElementById('player-hands') || document.body)
      .getPropertyValue('--cq-hand-scale').trim(),
    hasSplitClass: document.getElementById('player-hands')?.classList.contains('casino-seat-cards-split'),
    hasSplit4Class: document.getElementById('player-hands')?.classList.contains('casino-seat-cards-split-4'),
    viewportTransform: viewport ? getComputedStyle(viewport).transform : 'none',
    cardOverflowShell,
    cardOverflowGrid,
    elements,
  };
}
"""

SETUP_HANDEND = """
() => {
  const a = window.app;
  a.phase = 'handEnd';
  a.results = a.playerHands.map((h, i) => ({
    r: i % 2 ? 'win' : 'loss',
    label: 'Hand ' + (i + 1),
    net: i % 2 ? h.bet : -h.bet,
  }));
  a.roundReview = {
    runningCountAtHandStart: a.counter.runningCount - 3,
    bet: 25,
    suggested: 40,
    decisions: [{ action: 'hit', advice: 'stand', mistake: true }],
  };
  a.handNetPL = a.results.reduce((s, r) => s + r.net, 0);
  a.render();
  a.syncCasinoShellMetrics();
  return { phase: a.phase };
}
"""

HANDEND_AUDIT = """
() => {
  const pick = (el) => {
    if (!el) return null;
    return {
      hasHScroll: el.scrollWidth > el.clientWidth + 1,
      hasVScroll: el.scrollHeight > el.clientHeight + 1,
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    };
  };
  const handend = document.getElementById('screen-handend');
  const panel = document.querySelector('.handend-panel');
  return {
    phase: window.app?.phase,
    handendVisible: handend && !handend.classList.contains('hidden'),
    pageOverflowV: document.documentElement.scrollHeight > window.innerHeight + 1,
    pageOverflowH: document.documentElement.scrollWidth > window.innerWidth + 1,
    handend: pick(handend),
    panel: pick(panel),
    summary: document.getElementById('handend-summary')?.textContent?.slice(0, 120),
    countStrip: document.getElementById('handend-count')?.textContent?.slice(0, 120),
    review: document.getElementById('handend-review')?.textContent?.slice(0, 120),
    viewportTransform: getComputedStyle(document.querySelector('.casino-table-viewport')).transform,
  };
}
"""


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run() -> dict:
    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 720})
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=45000)
            page.wait_for_function("() => !!window.app", timeout=90000)

            setup = page.evaluate(SETUP_SPLIT_WIDE)
            page.wait_for_function(
                "() => document.querySelectorAll('#player-hands .casino-player-hand').length >= 4",
                timeout=10000,
            )
            time.sleep(0.4)
            playing = page.evaluate(SCROLL_AUDIT)

            page.evaluate(SETUP_HANDEND)
            page.wait_for_function("() => window.app.phase === 'handEnd'", timeout=10000)
            time.sleep(0.35)
            handend = page.evaluate(HANDEND_AUDIT)

            shot_dir = ROOT / "artifacts"
            shot_dir.mkdir(exist_ok=True)
            page.screenshot(path=str(shot_dir / "probe-1280x720-split-handend.png"), full_page=False)

            browser.close()

        def elem_ok(audit: dict) -> bool:
            for info in (audit.get("elements") or {}).values():
                if info and (info.get("hasHScroll") or info.get("hasVScroll")):
                    return False
            return True

        checks = {
            "split_4_hands": setup.get("splitN") == 4,
            "max_cards_7plus": setup.get("maxCards", 0) >= 7,
            "hand_scale_applied": float(setup.get("handScale") or "1") < 0.95,
            "no_page_scroll_playing": not playing["pageOverflowV"] and not playing["pageOverflowH"],
            "no_element_scroll_playing": elem_ok(playing),
            "split_classes": playing["hasSplitClass"] and playing["hasSplit4Class"],
            "cards_in_shell": playing["cardOverflowShell"] == 0,
            "viewport_fit_ok": (
                playing["viewportTransform"] != "none"
                or (not playing["pageOverflowV"] and playing["cardOverflowShell"] == 0)
            ),
            "no_page_scroll_handend": not handend["pageOverflowV"] and not handend["pageOverflowH"],
            "no_handend_scroll": not (handend.get("panel") or {}).get("hasVScroll")
            and not (handend.get("panel") or {}).get("hasHScroll"),
            "handend_dock_visible": handend.get("handendVisible"),
            "count_strip_present": bool(handend.get("countStrip")),
        }
        return {
            "viewport": "1280x720",
            "setup": setup,
            "playing": playing,
            "handend": handend,
            "checks": checks,
            "pass": all(checks.values()),
        }
    finally:
        httpd.shutdown()


def main() -> int:
    result = run()
    print(json.dumps(result, indent=2))
    print("PASS" if result["pass"] else "FAIL")
    return 0 if result["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())