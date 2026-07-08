#!/usr/bin/env python3
"""Display CountQuest Mistake Review Log implementation summary in Rich tables."""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
console = Console()

DRILL_LABELS = {
    "count-speed": "⚡ Running Count Speed Drill",
    "count-shoe": "🔢 Count This Shoe",
    "decisions": "🎯 Decision Drills",
    "betting": "💰 Bet Sizing Drill",
    "true-count": "📐 True Count Conversion Drill",
    "combined": "🃏 Combined Practice",
    "index-plays": "🧠 Index Play Drill",
    "bet-spread": "📈 Bet Spread Practice",
}

CATEGORY_LABELS = {
    "count": "Counting",
    "strategy": "Basic Strategy",
    "deviation": "Index Play",
    "bet": "Bet Sizing",
    "spread": "Bet Spread",
}

BUILT = [
    ("Unified store", "save.mistakeReviewLog.entries — capped at 150, newest first"),
    ("Entry fields", "drillId, ts, category, context, wrong, correct, detail, meta"),
    ("Per-mistake hooks", "All 8 live drills log each wrong answer as it happens"),
    ("Review Mistakes UI", "screen-training-mistakes with drill filters and You vs Correct cards"),
    ("Summary panel", "Total mistakes, last-7-days count, top drill, category breakdown"),
    ("Training Mode entry", "📋 Review Mistakes button below Training History"),
    ("Save migration", "defaultMistakeReviewLog() added to defaultSave + migrateSave"),
]

HOOKS = [
    ("count-speed", "Running count off by more than ±1"),
    ("true-count", "True count guess incorrect"),
    ("count-shoe", "End-of-shoe count quiz wrong"),
    ("decisions", "Basic strategy play wrong"),
    ("betting", "Bet amount does not match recommendation"),
    ("index-plays", "Index deviation answer wrong"),
    ("bet-spread", "Bet units inappropriate (incl. heat / timeout)"),
    ("combined", "Post-hand count quiz wrong or strategy mistake"),
]

NEXT = [
    ("Spaced repetition", "Resurface mistakes you miss most often"),
    ("Drill-from-mistake", "One-click practice on your weakest category"),
    ("Clear / archive", "Reset log or archive old entries"),
    ("Mistake streaks", "Track days without repeating the same error"),
    ("Export", "Download mistake log as CSV for study"),
    ("Rich CLI mirror", "Terminal mistake review in countquest package"),
]


def sample_entries() -> list[dict]:
    """Demo rows mirroring in-game recordMistakeReviewEntry shape."""
    now = datetime.now()
    rows = [
        ("count-speed", "count", "After 40 cards (fast pace)", "+2", "+5", "Off by 3"),
        ("true-count", "count", "RC +6 ÷ 2 decks", "+2.0", "+3.0", "Off by 1.0"),
        ("index-plays", "deviation", "16 vs 10 at TC -1", "Stand", "Hit", "Below index +0 — hit"),
        ("bet-spread", "spread", "True count +4.2 · high count", "3 units ($30)", "5 units ($50)", "Ramp up at TC +4"),
        ("combined", "strategy", "Hand 3: Your 16 vs dealer 10", "Stand", "Hit", ""),
        ("decisions", "strategy", "Hand 4/10: Your 12 vs dealer 4", "Hit", "Stand", ""),
        ("betting", "bet", "Round 2/8 · TC +2.0", "$10", "$30", "True count edge warrants a raise"),
        ("count-shoe", "count", "After 28 cards dealt from the shoe", "+1", "+4", "Off by 3"),
    ]
    out = []
    for i, (drill_id, category, context, wrong, correct, detail) in enumerate(rows):
        out.append({
            "drillId": drill_id,
            "category": category,
            "ts": int((now - timedelta(hours=i * 3)).timestamp() * 1000),
            "context": context,
            "wrong": wrong,
            "correct": correct,
            "detail": detail,
        })
    return out


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]Mistake Review Log[/]\n[dim]Save training errors · review what you chose vs what was correct[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="red",
        )
    )
    console.print()

    entries = sample_entries()
    log = Table(title="Mistake Review Log (sample)", border_style="red", header_style="bold gold1")
    log.add_column("When", style="dim", min_width=16)
    log.add_column("Drill", style="white", min_width=26)
    log.add_column("Category", style="cyan", min_width=12)
    log.add_column("You", style="red")
    log.add_column("Correct", style="green")
    log.add_column("Context", style="dim", max_width=28)

    for e in entries:
        when = datetime.fromtimestamp(e["ts"] / 1000).strftime("%b %d %H:%M")
        log.add_row(
            when,
            DRILL_LABELS.get(e["drillId"], e["drillId"]),
            CATEGORY_LABELS.get(e["category"], e["category"]),
            e["wrong"],
            e["correct"],
            e["context"],
        )
    console.print(log)
    console.print()

    built = Table(title="What was implemented", border_style="green", header_style="bold")
    built.add_column("Component", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for a, b in BUILT:
        built.add_row(a, b)
    console.print(built)
    console.print()

    hooks = Table(title="Drill mistake hooks", border_style="yellow", header_style="bold")
    hooks.add_column("Drill", style="cyan", min_width=14)
    hooks.add_column("Logged when", style="white")
    for a, b in HOOKS:
        hooks.add_row(DRILL_LABELS.get(a, a), b)
    console.print(hooks)
    console.print()

    nxt = Table(title="Good next additions", border_style="blue", header_style="bold")
    nxt.add_column("Item", style="cyan", min_width=16)
    nxt.add_column("Detail", style="white")
    for a, b in NEXT:
        nxt.add_row(a, b)
    console.print(nxt)
    console.print()

    checks = [
        "recordMistakeReviewEntry",
        "screen-training-mistakes",
        "summarizeMistakeReview",
        "openMistakeReview",
        "btn-training-mistakes",
    ]
    missing = [c for c in checks if c not in html]
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    ok = proc.returncode == 0 and not missing
    if missing:
        console.print(Text(f"Missing in index.html: {', '.join(missing)}", style="bold red"))
    console.print(Text(f"Tests: {'PASS' if ok else 'FAIL'}", style="bold green" if ok else "bold red"))
    console.print("[dim]In-game: Training Mode → 📋 Review Mistakes[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())