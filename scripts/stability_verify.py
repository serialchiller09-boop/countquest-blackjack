#!/usr/bin/env python3
"""Stability verification: launch, felt rules, casino DOM, bet→deal flow."""

from __future__ import annotations

import http.server
import json
import os
import socket
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FELT_MARKERS = [
    "cq-felt-rail-outer",
    "cq-felt-rail-inner",
    "cq-felt-seat-circles",
    "Q 600 648 1152 548",
]

SETUP_BET_PHASE = """
async () => {
  const a = window.app;
  a.closeAllModals();
  a.save.stats.helpLevel = 0;
  a.stats.helpLevel = 0;
  a.save.settings.practiceMode = true;
  a.startSession(true, 'practice-range');
  a.closeAllModals();
  a.phase = 'bet';
  a.render();
  a.syncCasinoShellMetrics();
}
"""

DISMISS_BLOCKING_MODALS = """
() => {
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
}
"""


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> int:
    os.chdir(ROOT)
    scratch = os.environ.get("CQ_SCRATCH")
    out_dir = Path(scratch) if scratch else ROOT / "artifacts"
    out_dir.mkdir(parents=True, exist_ok=True)

    port = free_port()
    httpd = http.server.HTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}/index.html"

    from playwright.sync_api import sync_playwright

    results: dict = {"loads": [], "felt": {}, "dom": {}, "deal": {}, "pass": True}
    page_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})

        def on_error(err) -> None:
            page_errors.append(str(err))

        page.on("pageerror", on_error)

        for load_idx in (1, 2):
            page_errors.clear()
            page.goto(base, wait_until="networkidle", timeout=60000)
            page.wait_for_function("() => !!window.app", timeout=120000)
            results["loads"].append({
                "load": load_idx,
                "hasApp": page.evaluate("() => !!window.app"),
                "pageErrors": list(page_errors),
            })
            if page_errors or not results["loads"][-1]["hasApp"]:
                results["pass"] = False

        page.wait_for_timeout(500)
        page.evaluate(DISMISS_BLOCKING_MODALS)
        page.evaluate(SETUP_BET_PHASE)
        page.wait_for_timeout(600)
        page.evaluate(DISMISS_BLOCKING_MODALS)

        felt_html = page.evaluate("() => document.getElementById('cq-felt-markings')?.innerHTML || ''")
        felt_missing = [s for s in FELT_MARKERS if s not in felt_html]
        results["felt"] = {"missing": felt_missing, "ok": not felt_missing}
        if felt_missing:
            results["pass"] = False

        page.screenshot(path=str(out_dir / "casino_felt_390.png"), full_page=False)

        dom = page.evaluate(
            """() => ({
              betRailHidden: document.getElementById('casino-felt-bet-rail')?.classList.contains('hidden'),
              seatCount: document.querySelectorAll('#casino-seat-grid .casino-seat').length,
              hasSync: typeof window.app.syncCasinoShellMetrics === 'function',
              phase: window.app.phase,
              dealerCards: !!document.getElementById('dealer-cards'),
              playerHands: !!document.getElementById('player-hands'),
              seatGrid: !!document.getElementById('casino-seat-grid'),
            })"""
        )
        results["dom"] = dom
        if (
            dom.get("betRailHidden")
            or dom.get("seatCount", 0) < 7
            or not dom.get("hasSync")
            or not dom.get("dealerCards")
            or not dom.get("playerHands")
            or not dom.get("seatGrid")
            or dom.get("phase") != "bet"
        ):
            results["pass"] = False

        phase_before = dom.get("phase")
        page_errors.clear()
        page.evaluate(DISMISS_BLOCKING_MODALS)
        deal_ok = page.evaluate(
            """async () => {
              const a = window.app;
              const input = document.getElementById('bet-input');
              if (input && !input.value) input.value = String(a.minBet || 10);
              await a.placeBet(input?.value || a.minBet || 10);
              return a.phase;
            }"""
        )
        page.wait_for_function("() => window.app.phase === 'playing'", timeout=20000)
        phase_after = page.evaluate("() => window.app.phase")
        results["deal"] = {
            "phaseBefore": phase_before,
            "phaseAfter": phase_after,
            "dealApiPhase": deal_ok,
            "pageErrors": list(page_errors),
            "ok": deal_ok == "playing" and phase_after == "playing" and not page_errors,
        }
        if not results["deal"]["ok"]:
            results["pass"] = False

        browser.close()

    httpd.shutdown()

    (out_dir / "casino_dom_check.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (out_dir / "stability_verify.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (out_dir / "deal_flow.log").write_text(
        f"phase_before={phase_before}\nphase_after={phase_after}\n"
        f"deal_api_phase={deal_ok}\nerrors={page_errors}\n",
        encoding="utf-8",
    )

    print(json.dumps(results, indent=2))
    print("PASS" if results["pass"] else "FAIL")
    return 0 if results["pass"] else 1


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT))
    raise SystemExit(main())