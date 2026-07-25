"""Verify 3-hand auto-flow in browser with real UI bindings."""
import http.server
import socket
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def snap(page):
    return page.evaluate("""() => ({
      phase: app.phase,
      awaiting: app._awaitingNextHand,
      dealing: app.dealing,
      locked: app.isDealLocked(),
      layout: app.settings.tableLayout,
      seats: [...document.querySelectorAll('#casino-seat-grid .casino-seat')].filter(e => e.offsetParent !== null).length,
      dealText: document.getElementById('btn-deal')?.textContent,
      build: document.getElementById('cq-build-stamp')?.textContent,
      hands: app.session?.hands,
    })""")


def main():
    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=30000)
        page.wait_for_function("() => !!window.app", timeout=30000)
        page.evaluate("() => { app.startSession(true, 'practice-range'); app.beginBetPhase(); }")
        for hand in range(1, 4):
            print(f"hand {hand} bet:", snap(page))
            page.evaluate("() => app.placeBet(app.minBet)")
            page.wait_for_function("() => app.phase === 'playing'", timeout=15000)
            page.evaluate("() => app.playerAction('stand')")
            page.wait_for_function("() => app._awaitingNextHand || app.phase === 'handEnd' || app.phase === 'playing'", timeout=15000)
            time.sleep(0.3)
            print(f"hand {hand} after stand:", snap(page))
            page.wait_for_function("() => app.session.hands >= " + str(hand), timeout=15000)
            if hand < 3:
                page.wait_for_function("() => app.phase === 'playing' && !app.isDealLocked()", timeout=15000)
                time.sleep(0.3)
                print(f"hand {hand + 1} ready:", snap(page))
        print("PASS" if page.evaluate("() => app.session.hands") >= 3 else "FAIL")
        browser.close()
    httpd.shutdown()


if __name__ == "__main__":
    main()