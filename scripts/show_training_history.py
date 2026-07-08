#!/usr/bin/env python3
"""Display CountQuest training drill history in a Rich table."""

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
import sys
sys.path.insert(0, str(ROOT / "scripts"))
from load_project_source import load_app_source  # noqa: E402
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

BUILT = [
    ("Unified store", "save.trainingHistory.sessions — one expandable log for all drills"),
    ("Session fields", "drillId, ts, attempts, accuracy, avgError, meta"),
    ("Auto-save hooks", "All 6 live drills record a session when a round ends"),
    ("Legacy backfill", "Imports speed + combined sessions from older per-drill stores"),
    ("Training History UI", "screen-training-history with filters and trend summary"),
    ("Improvement readout", "Recent vs earlier session accuracy comparison"),
    ("Drill badges", "Last session accuracy shown on Training Mode cards"),
]

NEXT = [
    ("Sparkline charts", "Per-drill accuracy line graph over last 20 sessions"),
    ("Streak tracking", "Longest correct-streak badges per drill"),
    ("Export CSV", "Download training history for spreadsheet analysis"),
    ("Weekly summary", "Rolling 7-day accuracy digest on main menu"),
    ("Goal targets", "Set accuracy goals and show progress bars"),
    ("Per-attempt detail", "Expand a session row to see each problem/hand"),
]


def sample_sessions() -> list[dict]:
    """Demo rows mirroring in-game recordTrainingHistorySession shape."""
    now = datetime.now()
    rows = [
        ("count-speed", 1, 100, 0.0, {"cardCount": 40, "speed": "fast"}),
        ("true-count", 10, 90, 0.12, {"difficulty": "decimal", "roundSize": 10}),
        ("combined", 5, 80, 0.2, {"countAccuracy": 80, "strategyAccuracy": 100, "hands": 5}),
        ("decisions", 10, 70, 0.3, {"correct": 7, "total": 10}),
        ("count-shoe", 1, 0, 3.0, {"cardsDealt": 28}),
        ("betting", 8, 88, 0.12, {"correct": 7, "total": 8}),
    ]
    out = []
    for i, (drill_id, attempts, accuracy, avg_error, meta) in enumerate(rows):
        out.append({
            "drillId": drill_id,
            "ts": int((now - timedelta(days=i, hours=i)).timestamp() * 1000),
            "attempts": attempts,
            "accuracy": accuracy,
            "avgError": avg_error,
            "meta": meta,
        })
    return out


def meta_summary(session: dict) -> str:
    m = session.get("meta") or {}
    drill = session["drillId"]
    if drill == "combined":
        return f"Count {m.get('countAccuracy', '?')}% · Strategy {m.get('strategyAccuracy', '?')}%"
    if drill == "count-speed":
        return f"{m.get('cardCount', '?')} cards · {m.get('speed', 'normal')}"
    if drill == "true-count":
        return f"{m.get('difficulty', '?')} · {m.get('roundSize', session['attempts'])} problems"
    if drill == "count-shoe":
        return f"{m.get('cardsDealt', '?')} cards dealt"
    if drill in ("decisions", "betting"):
        return f"{m.get('correct', '?')}/{m.get('total', session['attempts'])} correct"
    return f"{session['attempts']} attempts"


def trend_summary(sessions: list[dict]) -> str:
    if len(sessions) < 2:
        return "Need 2+ sessions to show improvement trend."
    sorted_s = sorted(sessions, key=lambda s: s["ts"])
    n = min(3, len(sorted_s) // 2 or 1)
    earlier = sum(s["accuracy"] for s in sorted_s[:n]) / n
    recent = sum(s["accuracy"] for s in sorted_s[-n:]) / n
    delta = round(recent - earlier)
    arrow = "↑" if delta > 0 else "↓" if delta < 0 else "→"
    return f"{arrow} Earlier {round(earlier)}% → Recent {round(recent)}% ({delta:+d}%)"


def main() -> int:
    html = load_app_source()
    console.print()
    console.print(
        Panel(
            "[bold]Training Progress Tracking[/]\n[dim]Unified session log · history screen · improvement trends[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="green",
        )
    )
    console.print()

    sessions = sample_sessions()
    hist = Table(title="Training History (sample)", border_style="cyan", header_style="bold gold1")
    hist.add_column("When", style="dim", min_width=18)
    hist.add_column("Drill", style="white", min_width=30)
    hist.add_column("Attempts", justify="right", style="cyan")
    hist.add_column("Accuracy", justify="right")
    hist.add_column("Avg Error", justify="right", style="dim")
    hist.add_column("Details", style="green")

    for s in sessions:
        when = datetime.fromtimestamp(s["ts"] / 1000).strftime("%b %d, %Y %H:%M")
        acc = s["accuracy"]
        acc_style = "green" if acc >= 80 else "yellow" if acc >= 60 else "red"
        hist.add_row(
            when,
            DRILL_LABELS.get(s["drillId"], s["drillId"]),
            str(s["attempts"]),
            Text(f"{acc}%", style=acc_style),
            str(s["avgError"]),
            meta_summary(s),
        )
    console.print(hist)
    console.print()
    console.print(Text(f"Trend: {trend_summary(sessions)}", style="bold cyan"))
    console.print()

    built = Table(title="What was implemented", border_style="green", header_style="bold")
    built.add_column("Component", style="cyan", min_width=18)
    built.add_column("Detail", style="white")
    for a, b in BUILT:
        built.add_row(a, b)
    console.print(built)
    console.print()

    nxt = Table(title="Good next additions for better tracking", border_style="blue", header_style="bold")
    nxt.add_column("Item", style="cyan", min_width=16)
    nxt.add_column("Detail", style="white")
    for a, b in NEXT:
        nxt.add_row(a, b)
    console.print(nxt)
    console.print()

    checks = [
        "recordTrainingHistorySession",
        "screen-training-history",
        "summarizeTrainingHistoryTrend",
        "openTrainingHistory",
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
    console.print("[dim]In-game: Training Mode [5] → 📈 Training History[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())