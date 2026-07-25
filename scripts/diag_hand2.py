"""Diagnose hand-2 deal failure with real UI + state logging."""
import http.server
import socket
import threading
import time
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def snap(page):
    return page.evaluate("""() => {
      const open = [...document.querySelectorAll('dialog')].filter(d => d.open).map(d => d.id);
      return {
        phase: app.phase,
        awaiting: app._awaitingNextHand,
        dealing: app.dealing,
        submitting: app._betSubmitting,
        locked: app.isDealLocked(),
        hands: app.session?.hands,
        practice: app.practice,
        autoFlow: app.shouldAutoFlowHands(),
        layout: app.settings.tableLayout,
        seats: [...document.querySelectorAll('#casino-seat-grid .casino-seat')].filter(e => e.offsetParent !== null).length,
        build: document.getElementById('cq-build-stamp')?.textContent,
        dealText: document.getElementById('btn-deal')?.textContent,
        dealLockedClass: document.getElementById('btn-deal')?.classList.contains('cq-deal-locked'),
        dockHidden: document.getElementById('casino-bottom-dock')?.classList.contains('hidden'),
        railHidden: document.getElementById('casino-felt-bet-rail')?.classList.contains('hidden'),
        openDialogs: open,
        playerFinished: app.playerHands?.every(h => h.finished),
        timer: !!app._autoNextHandTimer,
      };
    }""")


def main():
    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    from playwright.sync_api import sync_playwright

    logs = []
    ok = False
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.on("console", lambda m: logs.append(f"console:{m.type}:{m.text}"))
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=30000)
        page.wait_for_function("() => !!window.app", timeout=30000)
        page.evaluate("() => { app.startSession(true, 'practice-range'); app.beginBetPhase(); }")
        logs.append(f"start:{json.dumps(snap(page))}")

        # Hand 1 via UI
        page.click("#btn-deal", timeout=5000)
        page.wait_for_function("() => app.phase === 'playing'", timeout=20000)
        logs.append(f"h1-playing:{json.dumps(snap(page))}")
        page.wait_for_function("() => !app.dealing && !app.isDealLocked()", timeout=20000)
        page.click("#action-bar button[data-action='stand']", timeout=5000)
        page.wait_for_function("() => app._awaitingNextHand || app.phase === 'handEnd'", timeout=20000)
        logs.append(f"h1-ended:{json.dumps(snap(page))}")

        # Wait for auto-deal
        time.sleep(2.5)
        logs.append(f"h2-after-wait:{json.dumps(snap(page))}")

        # Hand 2 — click Deal Next Hand if auto-flow did not fire
        try:
            page.click("#btn-deal", timeout=3000, force=True)
            logs.append("deal-click:ok")
        except Exception as e:
            logs.append(f"deal-click:fail:{e}")

        try:
            page.wait_for_function(
                """() => {
                  const cards = document.querySelectorAll('#player-hands .playing-card').length;
                  return app.phase === 'playing'
                    && !app._awaitingNextHand
                    && cards >= 2
                    && !app.isDealLocked();
                }""",
                timeout=25000,
            )
            ok = True
        except Exception:
            ok = False
        logs.append(f"h2-final:{json.dumps(snap(page))}")
        print("\n".join(logs))
        print("RESULT:", "PASS" if ok else "FAIL")
        browser.close()
    httpd.shutdown()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())