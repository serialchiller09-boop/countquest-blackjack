"""Quick Playwright smoke test — load modular index.html and interact."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    from playwright.sync_api import sync_playwright

    url = "http://127.0.0.1:8765/index.html"
    out: dict = {"url": url, "errors": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.on("pageerror", lambda e: out["errors"].append(str(e)))

        page.goto(url, wait_until="networkidle", timeout=60000)
        page.wait_for_function("() => !!window.app", timeout=120000)

        out["title"] = page.title()
        out["modules"] = page.evaluate(
            """() => ({
              saveVersion: typeof SAVE_VERSION !== 'undefined' ? SAVE_VERSION : null,
              hasApp: !!window.app,
              phase: window.app?.phase,
              jsModules: [...document.querySelectorAll('script[src^="js/"]')]
                .map(s => s.getAttribute('src')),
              cssLinked: !!document.querySelector('link[href*="app.css"]'),
            })"""
        )

        menu = page.locator("#screen-menu")
        menu_cls = menu.get_attribute("class") or ""
        out["menuVisible"] = "hidden" not in menu_cls

        # Dismiss blocking modals (daily reward, etc.)
        daily = page.locator("#modal-daily-reward")
        if daily.count():
            try:
                page.wait_for_selector("#btn-daily-reward-claim", state="visible", timeout=8000)
                page.locator("#btn-daily-reward-claim").click(timeout=5000)
                page.wait_for_timeout(600)
            except Exception as exc:
                out.setdefault("modalDismiss", str(exc))
        for sel in ("#btn-help-levelup-close",):
            loc = page.locator(sel)
            if loc.count() and loc.first.is_visible():
                loc.first.click(timeout=3000)
                page.wait_for_timeout(400)

        # Navigate to a table via lobby hero or fallback menu button
        for sel in ("#lobby-hero-play", "[data-lobby-action='tables']", "#btn-play-tables"):
            loc = page.locator(sel)
            if loc.count():
                try:
                    loc.first.click(timeout=5000)
                    out["playClicked"] = sel
                    break
                except Exception as exc:
                    out.setdefault("clickAttempts", []).append({sel: str(exc)})

        page.wait_for_timeout(800)

        out["screens"] = page.evaluate(
            """() => ({
              menu: !document.getElementById('screen-menu')?.classList.contains('hidden'),
              tableLobby: !document.getElementById('screen-table-lobby')?.classList.contains('hidden'),
              casino: !document.getElementById('screen-casino-play')?.classList.contains('hidden'),
              phase: window.app?.phase,
            })"""
        )

        human = page.locator("#casino-seat-human")
        if human.count():
            out["humanSeatBox"] = human.bounding_box()

        shot = ROOT / "browser_smoke_menu.png"
        page.screenshot(path=str(shot), full_page=False)
        out["screenshot"] = str(shot)

        # Enter first available table if on table lobby
        if out["screens"].get("tableLobby"):
            table_btn = page.locator("[data-table-tier]:not([disabled])").first
            if table_btn.count():
                table_btn.click(timeout=5000)
                page.wait_for_timeout(800)
                out["screens"] = page.evaluate(
                    """() => ({
                      menu: !document.getElementById('screen-menu')?.classList.contains('hidden'),
                      tableLobby: !document.getElementById('screen-table-lobby')?.classList.contains('hidden'),
                      casino: !document.getElementById('screen-casino-play')?.classList.contains('hidden'),
                      phase: window.app?.phase,
                    })"""
                )

        # Start a practice hand if we reached casino screen
        if out["screens"].get("casino"):
            deal = page.locator("#btn-deal")
            if deal.count() and deal.is_visible():
                deal.click(timeout=5000)
                page.wait_for_timeout(1500)
                out["afterDeal"] = page.evaluate(
                    """() => {
                      const human = document.getElementById('casino-seat-human');
                      const cards = document.getElementById('player-hands');
                      const humanRect = human?.getBoundingClientRect();
                      const cardsRect = cards?.getBoundingClientRect();
                      const seatMid = humanRect ? humanRect.left + humanRect.width / 2 : null;
                      const cardsMid = cardsRect ? cardsRect.left + cardsRect.width / 2 : null;
                      return {
                        phase: window.app?.phase,
                        playerCards: document.querySelectorAll('#player-hands .playing-card').length,
                        humanStatus: document.querySelector('#casino-seat-human .casino-seat-status')?.textContent,
                        dealerCards: document.querySelectorAll('#dealer-cards .playing-card').length,
                        humanCardsOffsetPx: (seatMid != null && cardsMid != null) ? Math.round(cardsMid - seatMid) : null,
                      };
                    }"""
                )
                human = page.locator("#casino-seat-human")
                if human.count():
                    out["humanSeatBox"] = human.bounding_box()
                page.screenshot(path=str(ROOT / "browser_smoke_playing.png"), full_page=False)
                out["playingScreenshot"] = str(ROOT / "browser_smoke_playing.png")

        browser.close()

    out["ok"] = not out["errors"] and out["modules"].get("hasApp")
    print(json.dumps(out, indent=2))
    return 0 if out["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())