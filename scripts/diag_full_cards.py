"""Probe player card visibility in full 7-seat table layout."""
import http.server
import json
import socket
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PROBE = """
() => {
  const cardProbe = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return {
      w: r.width, h: r.height, top: r.top, bottom: r.bottom,
      overflow: st.overflow, visibility: st.visibility,
      opacity: st.opacity, display: st.display, position: st.position,
    };
  };
  const human = document.getElementById('casino-seat-human');
  const ph = document.getElementById('player-hands');
  const cards = [...document.querySelectorAll('#player-hands .playing-card')];
  const humanSt = human ? getComputedStyle(human) : null;
  const phSt = ph ? getComputedStyle(ph) : null;
  const grid = document.getElementById('casino-seat-grid');
  const vh = window.innerHeight;
  const cardsInView = cards.filter(c => {
    const r = c.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.top >= 0 && r.bottom <= vh;
  }).length;
  return {
    layout: app.settings.tableLayout,
    soloClass: document.body.classList.contains('casino-table-solo'),
    readableClass: document.body.classList.contains('casino-readable-play'),
    phase: app.phase,
    cardCount: cards.length,
    cardsInView,
    cards: cards.map(cardProbe),
    human: cardProbe(human),
    humanOverflow: humanSt?.overflow,
    ph: cardProbe(ph),
    phOverflow: phSt?.overflow,
    phPosition: phSt?.position,
    gridOverflow: grid ? getComputedStyle(grid).overflow : null,
    feltSolo: document.querySelector('.cq-authentic-felt')?.classList.contains('cq-table-solo'),
    viewportScale: getComputedStyle(document.querySelector('.casino-table-viewport')).transform,
  };
}
"""


def main():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=30000)
        page.wait_for_function("() => !!window.app", timeout=30000)
        page.evaluate(
            """() => {
              app.save.settings.tableLayout = 'full';
              app.tableAiSeats = null;
              app.ensureTableAiSeats();
              app.syncCasinoSeatLayout();
              app.startSession(false, 'campaign');
              app.beginBetPhase();
            }"""
        )
        page.click("#btn-deal", timeout=10000)
        page.wait_for_function(
            "() => app.phase === 'playing' && document.querySelectorAll('#player-hands .playing-card').length >= 2",
            timeout=25000,
        )
        page.wait_for_function("() => !app.dealing && app.phase === 'playing'", timeout=25000)
        time.sleep(0.5)
        page.evaluate("() => app.syncCasinoShellMetrics()")
        hit_probe = page.evaluate(
            """() => {
              const cards = [...document.querySelectorAll('#player-hands .playing-card')];
              return cards.map((c, i) => {
                const r = c.getBoundingClientRect();
                const x = r.left + r.width / 2;
                const y = r.top + r.height / 2;
                const topEl = document.elementFromPoint(x, y);
                return {
                  i,
                  opacity: getComputedStyle(c).opacity,
                  w: r.width,
                  h: r.height,
                  hit: topEl?.className || topEl?.id || topEl?.tagName,
                  isCard: topEl === c || c.contains(topEl) || topEl?.closest('.playing-card') === c,
                };
              });
            }"""
        )
        result = page.evaluate(PROBE)
        result["hitProbe"] = hit_probe
        print(json.dumps(result, indent=2))
        browser.close()
    httpd.shutdown()
    return 0 if result.get("cardsInView", 0) >= 2 else 1


if __name__ == "__main__":
    raise SystemExit(main())