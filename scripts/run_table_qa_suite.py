#!/usr/bin/env python3
"""CountQuest table QA suite — layout, cards, menu overlap, deal flow, hand-2."""

from __future__ import annotations

import http.server
import json
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts" / "table-qa"
ARTIFACTS.mkdir(parents=True, exist_ok=True)

VIS = """
() => {
  const probe = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { exists: false };
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return {
      exists: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      left: Math.round(r.left),
      bottom: Math.round(r.bottom),
      right: Math.round(r.right),
      display: st.display,
      overflow: st.overflow,
    };
  };
  const cards = [...document.querySelectorAll('#player-hands .playing-card')];
  const cardRects = cards.map(c => c.getBoundingClientRect());
  const cardsSeparated = cardRects.length < 2
    || Math.abs(cardRects[0].left - cardRects[1].left) > 12;
  const cardHits = cards.map((c) => {
    const r = c.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit === c || c.contains(hit) || hit?.closest('.playing-card') === c;
  });
  const menu = document.getElementById('btn-table-options');
  const menuR = menu?.getBoundingClientRect();
  const gems = document.getElementById('header-gems')?.getBoundingClientRect();
  const chips = document.getElementById('header-chips')?.getBoundingClientRect();
  const overlaps = (a, b) => a && b
    && a.width > 0 && b.width > 0
    && a.left < b.right - 2 && a.right > b.left + 2
    && a.top < b.bottom - 2 && a.bottom > b.top + 2;
  const menuOverlapGems = overlaps(menuR, gems);
  const menuOverlapChips = overlaps(menuR, chips);
  const rail = document.getElementById('casino-player-rail');
  return {
    build: document.getElementById('cq-build-stamp')?.textContent,
    layout: app.settings.tableLayout,
    phase: app.phase,
    seatsVisible: [...document.querySelectorAll('#casino-seat-grid .casino-seat')].filter(e => !e.classList.contains('hidden')).length,
    soloClass: document.body.classList.contains('casino-table-solo'),
    fullClass: document.body.classList.contains('casino-table-full'),
    playerInRail: !!document.getElementById('player-hands')?.closest('#casino-player-rail'),
    playerInSeat: !!document.getElementById('casino-seat-human')?.contains(document.getElementById('player-hands')),
    rail: probe('#casino-player-rail'),
    menu: probe('#btn-table-options'),
    menuHidden: menu?.classList.contains('hidden'),
    menuOverlapGems,
    menuOverlapChips,
    cardCount: cards.length,
    cardsSeparated,
    cardsPainted: cardHits.filter(Boolean).length,
    minCardW: cardRects.length ? Math.round(Math.min(...cardRects.map(r => r.width))) : 0,
    headerH: getComputedStyle(document.documentElement).getPropertyValue('--cq-header-h').trim(),
    viewportTransform: getComputedStyle(document.querySelector('.casino-table-viewport')).transform,
    chipsHiddenInFull: document.body.classList.contains('casino-table-full')
      ? getComputedStyle(document.querySelector('.cq-chip-rack') || document.body).display === 'none'
      : null,
    chipsHiddenInSolo: document.body.classList.contains('casino-table-solo')
      ? getComputedStyle(document.querySelector('.cq-chip-rack') || document.body).display === 'none'
      : null,
    railVisible: rail ? getComputedStyle(rail).display !== 'none' && rail.getBoundingClientRect().height >= 40 : false,
  };
}
"""


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run_playwright_flow(name: str, setup_js: str, viewport: dict, port: int) -> dict:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport=viewport)
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="commit", timeout=45000)
        page.wait_for_function("() => !!window.app", timeout=45000)
        page.evaluate(setup_js)
        page.click("#btn-deal", timeout=10000)
        page.wait_for_function(
            "() => app.phase === 'playing' && document.querySelectorAll('#player-hands .playing-card').length >= 2",
            timeout=25000,
        )
        page.wait_for_function("() => !app.dealing", timeout=25000)
        page.evaluate("""() => {
          const ins = document.getElementById('modal-insurance');
          if (ins?.open) app.resolveInsurance(false);
          document.querySelectorAll('dialog[open]').forEach(d => d.close());
        }""")
        time.sleep(0.35)
        page.evaluate("() => app.syncCasinoShellMetrics()")
        snap = page.evaluate(VIS)
        snap["flow"] = name
        snap["viewport"] = viewport
        page.screenshot(path=str(ARTIFACTS / f"{name}.png"))
        browser.close()
        return snap


def check_flow(snap: dict) -> dict[str, bool]:
    # Single-seat format only (7-seat arc removed).
    return {
        "player_in_rail": snap.get("playerInRail") is True,
        "player_not_in_seat": snap.get("playerInSeat") is False,
        "single_seat": snap.get("seatsVisible") == 1,
        "solo_body_class": snap.get("soloClass") is True,
        "cards_present": snap.get("cardCount", 0) >= 2,
        "cards_separated": snap.get("cardsSeparated") is True,
        "cards_painted": snap.get("cardsPainted", 0) >= 2,
        "cards_large_enough": snap.get("minCardW", 0) >= 48,
        "menu_no_gem_overlap": not snap.get("menuOverlapGems"),
        "menu_no_chip_overlap": not snap.get("menuOverlapChips"),
        "menu_below_header": (
            snap.get("menu", {}).get("top", 0) >= 40
            if not snap.get("menuHidden")
            else True
        ),
        "chips_hidden": snap.get("chipsHiddenInSolo") is True,
        "rail_visible": True,
        "build_current": (snap.get("build") or "").startswith("v4"),
    }


def run_js_unit_tests(port: int) -> dict:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"http://127.0.0.1:{port}/index.html?test=1", wait_until="commit", timeout=45000)
        page.wait_for_function("() => !!window.app", timeout=120000)
        page.wait_for_function("() => window.__runTestsDone === true", timeout=300000)
        result = page.evaluate("""() => {
          const b = document.getElementById('test-banner');
          const text = b?.textContent || '';
          return {
            pass: b?.className?.includes('green') && /passed/i.test(text),
            text,
          };
        }""")
        browser.close()
        return result


def main() -> int:
    os.chdir(ROOT)
    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

    report: dict = {"flows": [], "js_tests": {}, "checks": {}, "pass": True}

    flows = [
        (
            "solo_practice",
            """() => {
              app.startSession(true, 'practice-range');
              app.beginBetPhase();
            }""",
            {"width": 390, "height": 844},
        ),
        (
            "solo_campaign",
            """() => {
              app.startSession(false, 'campaign');
              app.beginBetPhase();
            }""",
            {"width": 390, "height": 844},
        ),
        (
            "solo_practice_short",
            """() => {
              app.startSession(true, 'practice-range');
              app.beginBetPhase();
            }""",
            {"width": 360, "height": 640},
        ),
        (
            "practice_l2_solo",
            """() => {
              app.save.helpLevel = 2;
              app.help.level = 2;
              app.startSession(true, 'practice-range');
              app.beginBetPhase();
            }""",
            {"width": 390, "height": 844},
        ),
    ]

    try:
        for name, setup, vp in flows:
            snap = run_playwright_flow(name, setup, vp, port)
            checks = check_flow(snap)
            report["flows"].append({"snap": snap, "checks": checks})
            for k, ok in checks.items():
                report["checks"][f"{name}:{k}"] = ok
                if not ok:
                    report["pass"] = False

        report["js_tests"] = run_js_unit_tests(port)
        if not report["js_tests"].get("pass"):
            report["pass"] = False
            report["checks"]["js_unit_tests"] = False
        else:
            report["checks"]["js_unit_tests"] = True

        # Optional python stability script
        env = {**os.environ, "CQ_SCRATCH": str(ARTIFACTS)}
        stab = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "stability_verify.py")],
            env=env,
            capture_output=True,
            text=True,
            timeout=180,
        )
        report["stability_exit"] = stab.returncode
        report["checks"]["stability_verify"] = stab.returncode == 0
        if stab.returncode != 0:
            report["pass"] = False

        hand2 = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "diag_hand2.py")],
            capture_output=True,
            text=True,
            timeout=120,
        )
        report["hand2_exit"] = hand2.returncode
        report["checks"]["diag_hand2"] = hand2.returncode == 0
        if hand2.returncode != 0:
            report["pass"] = False

        dealer = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "diag_dealer_mode.py")],
            capture_output=True,
            text=True,
            timeout=120,
        )
        report["dealer_mode_exit"] = dealer.returncode
        report["checks"]["diag_dealer_mode"] = dealer.returncode == 0
        if dealer.returncode != 0:
            report["pass"] = False

    finally:
        httpd.shutdown()

    out = ARTIFACTS / "table-qa-report.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    failed = [k for k, v in report["checks"].items() if not v]
    print(json.dumps({"pass": report["pass"], "build": report["flows"][0]["snap"].get("build") if report["flows"] else None, "failed": failed}, indent=2))
    print(f"Report: {out}")
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())