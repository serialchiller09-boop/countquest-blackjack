"""Reproduce full 7-seat card visibility using realistic user flows."""
import http.server
import json
import socket
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = ROOT / "_diag_scratch"
SCRATCH.mkdir(exist_ok=True)

VIS = """
() => {
  const shell = document.getElementById('screen-casino-play');
  const viewport = document.querySelector('.casino-table-viewport');
  const surface = document.querySelector('.casino-table-surface');
  const cards = [...document.querySelectorAll('#player-hands .playing-card')];
  const shellR = shell?.getBoundingClientRect();
  const visR = viewport?.getBoundingClientRect();
  const cardRects = cards.map(c => c.getBoundingClientRect());
  const cardsSeparated = cardRects.length < 2
    || Math.abs(cardRects[0].left - cardRects[1].left) > 12;
  const cardInfo = cards.map((c, i) => {
    const r = c.getBoundingClientRect();
    const st = getComputedStyle(c);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const inShell = shellR && r.bottom > shellR.top && r.top < shellR.bottom && r.width > 1 && r.height > 1;
    const painted = hit && (hit === c || c.contains(hit) || hit.closest('.playing-card') === c);
    return {
      i,
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      left: Math.round(r.left),
      bottom: Math.round(r.bottom),
      opacity: st.opacity,
      painted,
      hit: (hit?.className || hit?.id || hit?.tagName || '').toString().slice(0, 60),
      inShell,
    };
  });
  const human = document.getElementById('casino-seat-human');
  const humanR = human?.getBoundingClientRect();
  return {
    build: document.getElementById('cq-build-stamp')?.textContent,
    layout: app.settings.tableLayout,
    practice: app.practice,
    phase: app.phase,
    seatsVisible: [...document.querySelectorAll('#casino-seat-grid .casino-seat')].filter(e => !e.classList.contains('hidden')).length,
    soloClass: document.body.classList.contains('casino-table-solo'),
    readableClass: document.body.classList.contains('casino-readable-play'),
    feltSolo: document.querySelector('.cq-authentic-felt')?.classList.contains('cq-table-solo'),
    humanOverflow: human ? getComputedStyle(human).overflow : null,
    surfaceOverflow: surface ? getComputedStyle(surface).overflow : null,
    shellOverflow: shell ? getComputedStyle(shell).overflow : null,
    viewportTransform: viewport ? getComputedStyle(viewport).transform : null,
    shellRect: shellR ? { top: Math.round(shellR.top), bottom: Math.round(shellR.bottom), h: Math.round(shellR.height) } : null,
    humanRect: humanR ? { top: Math.round(humanR.top), bottom: Math.round(humanR.bottom) } : null,
    cardCount: cards.length,
    cardsSeparated,
    cardsPainted: cardInfo.filter(c => c.painted).length,
    cardsInShell: cardInfo.filter(c => c.inShell).length,
    cards: cardInfo,
  };
}
"""


def serve(port):
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def run_flow(page, name, setup_js, viewport):
    page.set_viewport_size(viewport)
    page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=30000)
    page.wait_for_function("() => !!window.app", timeout=30000)
    page.evaluate(setup_js)
    page.click("#btn-deal", timeout=10000)
    page.wait_for_function(
        "() => app.phase === 'playing' && document.querySelectorAll('#player-hands .playing-card').length >= 2",
        timeout=25000,
    )
    page.wait_for_function("() => !app.dealing", timeout=25000)
    time.sleep(0.4)
    page.evaluate("() => app.syncCasinoShellMetrics()")
    time.sleep(0.2)
    snap = page.evaluate(VIS)
    snap["flow"] = name
    snap["viewport"] = viewport
    page.screenshot(path=str(SCRATCH / f"{name}.png"), full_page=False)
    return snap


def main():
    global port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    httpd = serve(port)
    from playwright.sync_api import sync_playwright

    flows = {
        "practice_default": """
          () => {
            app.startSession(true, 'practice-range');
            app.beginBetPhase();
          }
        """,
        "settings_full_then_practice": """
          () => {
            app.setTableLayout('full');
            app.startSession(true, 'practice-range');
            app.beginBetPhase();
          }
        """,
        "settings_full_campaign": """
          () => {
            app.setTableLayout('full');
            app.startSession(false, 'campaign');
            app.beginBetPhase();
          }
        """,
        "fresh_load_full_persisted": """
          () => {
            localStorage.setItem('countquest-blackjack', JSON.stringify({
              ...JSON.parse(localStorage.getItem('countquest-blackjack') || '{}'),
              settings: { ...(JSON.parse(localStorage.getItem('countquest-blackjack') || '{}').settings || {}), tableLayout: 'full' }
            }));
            location.reload();
          }
        """,
    }

    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        for fname, setup in [
            ("practice_default", flows["practice_default"]),
            ("settings_full_then_practice", flows["settings_full_then_practice"]),
            ("settings_full_campaign", flows["settings_full_campaign"]),
        ]:
            results.append(run_flow(page, fname, setup, {"width": 390, "height": 844}))

        # Short Android viewport — common clipping case
        results.append(
            run_flow(page, "full_campaign_short", flows["settings_full_campaign"], {"width": 360, "height": 640})
        )

        browser.close()

    out = SCRATCH / "full_cards_real.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))
    httpd.shutdown()

    ok = any(
      r["layout"] == "full"
      and r["cardsPainted"] >= 2
      and r.get("cardsSeparated")
      and r["cards"][0]["w"] >= 40
      for r in results
    )
    bad = [
      r["flow"] for r in results
      if r["layout"] == "full"
      and (r["cardsPainted"] < 2 or not r.get("cardsSeparated") or r["cards"][0]["w"] < 40)
    ]
    print(f"\nSUMMARY: full-layout flows failing visibility checks: {bad or 'none'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())