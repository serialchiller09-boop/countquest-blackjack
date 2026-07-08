"""Verify live GitHub Pages deploy on mobile viewports."""
from __future__ import annotations

import json
import sys

LIVE = "https://serialchiller09-boop.github.io/countquest-blackjack/index.html"
VIEWPORTS = [
    ("iphone14", 390, 844),
    ("android", 360, 800),
    ("iphone_landscape", 844, 390),
]


def main() -> int:
    from playwright.sync_api import sync_playwright

    results = {"live": LIVE, "viewports": {}, "casino": {}, "pwa": {}, "pass": True}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, w, h in VIEWPORTS:
            page = browser.new_page(viewport={"width": w, "height": h})
            page.goto(LIVE, wait_until="networkidle", timeout=90000)
            page.wait_for_function("() => !!window.app", timeout=120000)
            audit = page.evaluate(
                """() => ({
                  innerW: window.innerWidth,
                  innerH: window.innerHeight,
                  pageOverflowH: document.documentElement.scrollWidth > window.innerWidth + 1,
                  hasApp: !!window.app,
                  menuVisible: !document.getElementById('screen-menu')?.classList.contains('hidden'),
                  hasTailwind: !!document.querySelector('link[href*="tailwind.css"]'),
                  hasCdnTailwind: !!document.querySelector('script[src*="cdn.tailwindcss"]'),
                  modules: document.querySelectorAll('script[src^="js/"]').length,
                })"""
            )
            results["viewports"][name] = audit
            if (
                audit["pageOverflowH"]
                or audit["hasCdnTailwind"]
                or not audit["hasTailwind"]
                or audit["modules"] < 10
            ):
                results["pass"] = False
            page.close()

        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.goto(LIVE, wait_until="networkidle", timeout=90000)
        page.wait_for_function("() => !!window.app", timeout=120000)
        results["pwa"] = page.evaluate(
            """() => ({
              manifest: !!document.querySelector('link[rel="manifest"]'),
              themeColor: document.querySelector('meta[name="theme-color"]')?.content,
              swReady: 'serviceWorker' in navigator,
            })"""
        )
        page.evaluate(
            """() => {
              const a = window.app;
              a.save.stats.helpLevel = 0;
              a.stats.helpLevel = 0;
              a.save.settings.practiceMode = true;
              a.startSession(true, 'practice-range');
              a.phase = 'bet';
              a.render();
              a.syncCasinoShellMetrics();
            }"""
        )
        page.wait_for_timeout(1000)
        casino = page.evaluate(
            """() => {
              const shell = document.getElementById('screen-casino-play');
              const adv = document.getElementById('bet-advice');
              const vp = document.querySelector('.casino-table-viewport');
              return {
                casinoVisible: !shell?.classList.contains('hidden'),
                pageOverflowH: document.documentElement.scrollWidth > window.innerWidth + 1,
                shellScrollW: shell?.scrollWidth ?? 0,
                shellClientW: shell?.clientWidth ?? 0,
                betAdviceScrollW: adv?.scrollWidth ?? 0,
                betAdviceClientW: adv?.clientWidth ?? 0,
                vpTransform: vp?.style.transform || 'none',
                betAdviceVisible: adv && !adv.classList.contains('hidden'),
              };
            }"""
        )
        results["casino"] = casino
        shell_overflow = casino["shellScrollW"] > casino["shellClientW"] + 1
        if shell_overflow:
            casino["shellOverflow"] = True
        if (
            not casino["casinoVisible"]
            or casino["pageOverflowH"]
            or shell_overflow
            or not results["pwa"].get("manifest")
        ):
            results["pass"] = False
        browser.close()

    print(json.dumps(results, indent=2))
    print("PASS" if results["pass"] else "FAIL")
    return 0 if results["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())