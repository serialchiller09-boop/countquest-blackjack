"""Verify openClubs / ClubsRegistry does not hang or stack-overflow."""
from __future__ import annotations

import http.server
import socket
import sys
import threading
import time
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
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=30000)
            page.wait_for_function("() => !!window.app", timeout=60000)

            t0 = time.time()
            result = page.evaluate(
                """() => {
                  try {
                    localStorage.removeItem('cq_clubs_registry_v1');
                    if (window.ClubsRegistry) ClubsRegistry.invalidate();
                    const t1 = performance.now();
                    const all = ClubsRegistry.getAll();
                    const t2 = performance.now();
                    window.app.handleLobbyNav('clubs');
                    const t3 = performance.now();
                    const screen = document.getElementById('screen-clubs');
                    return {
                      ok: true,
                      registryMs: t2 - t1,
                      openMs: t3 - t2,
                      phase: window.app.phase,
                      clubsVisible: screen && !screen.classList.contains('hidden'),
                      clubCount: all.length,
                      inviteCodes: all.map(c => c.inviteCode).filter(Boolean).length,
                    };
                  } catch (e) {
                    return { ok: false, error: String(e) };
                  }
                }"""
            )
            elapsed = time.time() - t0
            browser.close()

        print("clubs_freeze_probe:", result, f"wall={elapsed:.3f}s")
        if not result.get("ok"):
            return 1
        if result.get("phase") != "clubs" or not result.get("clubsVisible"):
            return 1
        if result.get("registryMs", 9999) > 2000 or result.get("openMs", 9999) > 2000:
            return 1
        if result.get("inviteCodes", 0) < 2:
            return 1
        return 0
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    sys.exit(main())