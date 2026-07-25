#!/usr/bin/env python3
"""Dealer Mode — verify full playing cards render at mobile size."""

from __future__ import annotations

import http.server
import socket
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    ok = False
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 390, "height": 844})
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=45000)
            page.wait_for_function("() => !!window.app", timeout=45000)
            page.evaluate("() => app.openDealerMode('training')")
            page.click("#btn-dealer-mode-start", timeout=10000)
            page.wait_for_function(
                "() => !document.getElementById('dealer-mode-active')?.classList.contains('hidden')",
                timeout=15000,
            )
            page.wait_for_function(
                "() => document.querySelectorAll('#dealer-mode-dealer-cards .playing-card').length >= 2",
                timeout=20000,
            )
            snap = page.evaluate("""() => {
              const cards = [...document.querySelectorAll('#dealer-mode-dealer-cards .playing-card')];
              const rects = cards.map(c => c.getBoundingClientRect());
              const painted = cards.map((c) => {
                const r = c.getBoundingClientRect();
                const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                return hit === c || c.contains(hit);
              });
              const visible = cards.filter(c => !c.classList.contains('back'));
              return {
                build: document.getElementById('cq-build-stamp')?.textContent,
                count: cards.length,
                visibleCount: visible.length,
                minW: rects.length ? Math.min(...rects.map(r => r.width)) : 0,
                minH: rects.length ? Math.min(...rects.map(r => r.height)) : 0,
                painted: painted.filter(Boolean).length,
                faceCards: visible.filter(c => !!c.querySelector('.corner') && !!c.querySelector('.center-suit')).length,
              };
            }""")
            ok = (
                snap.get("count", 0) >= 2
                and snap.get("visibleCount", 0) >= 1
                and snap.get("minW", 0) >= 40
                and snap.get("minH", 0) >= 56
                and snap.get("painted", 0) >= 2
                and snap.get("faceCards", 0) >= 1
            )
            print(snap)
            print("RESULT:", "PASS" if ok else "FAIL")
            browser.close()
    finally:
        httpd.shutdown()

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())