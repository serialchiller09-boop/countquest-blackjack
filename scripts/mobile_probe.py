"""Verify PWA shell on mobile viewports — no scroll, modules load."""
from __future__ import annotations

import http.server
import json
import socket
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

VIEWPORTS = [
    ("iphone14", 390, 844),
    ("android", 360, 800),
    ("iphone_landscape", 844, 390),
]

PWA_AUDIT = """
() => ({
  manifest: !!document.querySelector('link[rel="manifest"]'),
  themeColor: document.querySelector('meta[name="theme-color"]')?.content,
  appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
  swReady: 'serviceWorker' in navigator,
  testModeSkipsSw: window.__CQ_TEST_MODE === true,
})
"""


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    import os

    os.chdir(ROOT)
    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    from playwright.sync_api import sync_playwright

    results = {"viewports": {}, "pwa": None, "pass": True}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, w, h in VIEWPORTS:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle", timeout=60000)
            page.wait_for_function("() => !!window.app", timeout=120000)
            audit = page.evaluate(
                """() => ({
                  innerW: window.innerWidth,
                  innerH: window.innerHeight,
                  pageOverflowV: document.documentElement.scrollHeight > window.innerHeight + 1,
                  pageOverflowH: document.documentElement.scrollWidth > window.innerWidth + 1,
                  hasApp: !!window.app,
                  menuVisible: !document.getElementById('screen-menu')?.classList.contains('hidden'),
                  modules: document.querySelectorAll('script[src^="js/"]').length,
                })"""
            )
            results["viewports"][name] = audit
            if audit["pageOverflowH"] or audit["modules"] < 10 or not audit["hasApp"]:
                results["pass"] = False
            page.close()

        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle", timeout=60000)
        page.wait_for_function("() => !!window.app", timeout=120000)
        results["pwa"] = page.evaluate(PWA_AUDIT)
        if not results["pwa"].get("manifest"):
            results["pass"] = False
        # Casino table: no horizontal overflow at phone width
        page.evaluate("""() => {
          const a = window.app;
          a.save.stats.helpLevel = 0;
          a.stats.helpLevel = 0;
          a.save.settings.practiceMode = true;
          a.startSession(true, 'practice-range');
          a.phase = 'bet';
          a.render();
          a.syncCasinoShellMetrics();
        }""")
        page.wait_for_timeout(800)
        casino = page.evaluate(
            """() => {
              const shell = document.getElementById('screen-casino-play');
              return {
                casinoVisible: !shell?.classList.contains('hidden'),
                pageOverflowH: document.documentElement.scrollWidth > window.innerWidth + 1,
                shellScrollW: shell?.scrollWidth ?? 0,
                shellClientW: shell?.clientWidth ?? 0,
              };
            }"""
        )
        results["casino_390"] = casino
        shell_overflow = (casino.get("shellScrollW") or 0) > (casino.get("shellClientW") or 0) + 1
        if shell_overflow:
            casino["shellOverflow"] = True
        if (
            not casino.get("casinoVisible")
            or casino.get("pageOverflowH")
            or shell_overflow
        ):
            results["pass"] = False
        browser.close()

    httpd.shutdown()
    print(json.dumps(results, indent=2))
    print("PASS" if results["pass"] else "FAIL")
    return 0 if results["pass"] else 1


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT))
    raise SystemExit(main())