#!/usr/bin/env python3
"""Load index.html in headless browser and report startup errors."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    errors: list[str] = []
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright not installed — pip install playwright && playwright install chromium")
        return 1

    url = "http://127.0.0.1:8765/index.html"
    if len(sys.argv) > 1:
        url = sys.argv[1]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda msg: errors.append(f"console: {msg.text}") if msg.type == "error" else None,
        )
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2500)
            title = page.title()
            cls = page.locator("#screen-menu").get_attribute("class") or ""
            visible = page.locator("#screen-menu").is_visible() and "hidden" not in cls
            fail_h1 = page.get_by_text("CountQuest failed to start").count()
            print(f"URL: {url}")
            print(f"Title: {title}")
            print(f"Lobby visible: {visible}")
            print(f"Startup crash screen: {fail_h1 > 0}")
            if fail_h1:
                pre = page.locator("pre").first
                if pre.count():
                    print("Error:", pre.inner_text()[:800])
            if errors:
                print("Browser errors:")
                for e in errors[:8]:
                    print(" ", e)
            return 0 if visible and fail_h1 == 0 and not errors else 1
        except Exception as exc:
            print(f"LOAD FAILED: {exc}")
            return 1
        finally:
            browser.close()


if __name__ == "__main__":
    raise SystemExit(main())