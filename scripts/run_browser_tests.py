"""Run embedded index.html runTests() in headless Chromium; exit 0 on success."""
from __future__ import annotations

import argparse
import http.server
import socket
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCRATCH = Path(r"C:\Users\User\AppData\Local\Temp\grok-goal-6c286b6fc604\implementer")


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    import os

    if not os.environ.get("CQ_BROWSER_TESTS"):
        print("SKIP: run_browser_tests (optional; set CQ_BROWSER_TESTS=1 to run embedded runTests in browser)")
        return 0
    parser = argparse.ArgumentParser()
    parser.add_argument("--scratch", type=Path, default=DEFAULT_SCRATCH)
    args = parser.parse_args()
    scratch = args.scratch
    scratch.mkdir(parents=True, exist_ok=True)
    log_path = scratch / "run-browser-tests.log"

    os.chdir(ROOT)
    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    logs: list[str] = []
    banner: dict = {}
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            passed = False

            def on_console(msg):
                text = f"[{msg.type}] {msg.text}"
                logs.append(text)
                if "All CountQuest tests passed" in msg.text:
                    nonlocal passed
                    passed = True

            page.on("console", on_console)
            page.on("pageerror", lambda exc: logs.append(f"[pageerror] {exc}"))
            page.goto(
                f"http://127.0.0.1:{port}/index.html?test=1",
                wait_until="commit",
                timeout=45000,
            )
            page.wait_for_function("() => !!window.app", timeout=120000)
            page.wait_for_function(
                "() => window.__runTestsDone === true",
                timeout=600000,
            )
            banner = page.evaluate("""() => {
              const b = document.getElementById('test-banner');
              return { text: b?.textContent || '', ok: b?.className?.includes('green') };
            }""")
            if banner.get("ok") and "passed" in (banner.get("text") or "").lower():
                passed = True
            browser.close()
        out_lines = logs + [
            f"banner: {banner}",
            f"embedded runTests: {'PASS' if passed else 'FAIL'}",
        ]
        log_path.write_text("\n".join(out_lines), encoding="utf-8")
        for line in out_lines:
            if "CountQuest tests" in line or "FAIL" in line or "banner:" in line or "pageerror" in line:
                print(line)
        print("embedded runTests:", "PASS" if passed else "FAIL")
        return 0 if passed else 1
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    sys.exit(main())