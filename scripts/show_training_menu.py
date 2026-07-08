#!/usr/bin/env python3
"""Display CountQuest Training Mode drill catalog via Rich."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
console = Console()

DRILL_RE = re.compile(
    r"\{\s*id:\s*'([^']+)',\s*category:\s*'([^']+)',\s*name:\s*'([^']+)',\s*"
    r"desc:\s*'([^']+)',\s*icon:\s*'([^']+)',\s*status:\s*'([^']+)'",
    re.MULTILINE,
)

NEXT_STEPS = [
    ("Wire True Count Trainer", "First new placeholder → full drill implementation"),
    ("Unify exit paths", "All drills return to Training Mode hub when launched from [5]"),
    ("Category filters", "Tabs: Counting · Strategy · Betting"),
    ("Per-drill stats", "Show accuracy badges on live drill cards"),
    ("Retire Practice Range", "Merge [2] shortcut into Training Mode once catalog is complete"),
    ("Achievements", "Unlock trophies for completing each live drill milestone"),
]


def parse_training_drills(html: str) -> list[dict[str, str]]:
    drills = []
    start = html.find("const TRAINING_DRILLS = [")
    if start < 0:
        return drills
    block = html[start : start + 6000]
    for m in DRILL_RE.finditer(block):
        drills.append({
            "id": m.group(1),
            "category": m.group(2),
            "name": m.group(3),
            "desc": m.group(4),
            "icon": m.group(5),
            "status": m.group(6),
        })
    return drills


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    drills = parse_training_drills(html)

    console.print()
    console.print(
        Panel(
            "[bold]Training Mode[/] — drill catalog hub\n"
            "[dim]Main menu [5] · expandable TRAINING_DRILLS registry[/]",
            title="[bold gold1]CountQuest Blackjack[/]",
            border_style="green",
        )
    )
    console.print()

    menu = Table(title="Training Mode Menu", border_style="cyan", header_style="bold gold1")
    menu.add_column("Icon", justify="center", width=4)
    menu.add_column("Drill", style="white", min_width=28)
    menu.add_column("Category", style="dim")
    menu.add_column("Status", justify="center")

    for d in drills:
        style = "bold green" if d["status"] == "live" else "dim yellow"
        label = "LIVE" if d["status"] == "live" else "SOON"
        menu.add_row(d["icon"], d["name"], d["category"], Text(label, style=style))

    console.print(menu)
    console.print()

    created = Table(title="What was created", border_style="green", header_style="bold")
    created.add_column("Component", style="cyan")
    created.add_column("Detail", style="white")
    rows = [
        ("Main menu [5]", "Training Mode — drill catalog hub"),
        ("screen-training", "HTML screen with training-drill-list + back button"),
        ("TRAINING_DRILLS", "Single registry: id, category, name, desc, icon, status, launch"),
        ("launchTrainingDrill()", "Routes live drills to existing session handlers"),
        ("Placeholders", f"{sum(1 for d in drills if d['status'] == 'soon')} coming-soon cards (disabled)"),
        ("Live drills", f"{sum(1 for d in drills if d['status'] == 'live')} playable now"),
    ]
    for a, b in rows:
        created.add_row(a, b)
    console.print(created)
    console.print()

    nxt = Table(title="Next logical steps", border_style="blue", header_style="bold")
    nxt.add_column("Step", style="cyan", width=22)
    nxt.add_column("Detail", style="white")
    for a, b in NEXT_STEPS:
        nxt.add_row(a, b)
    console.print(nxt)
    console.print()

    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    ok = proc.returncode == 0 and "screen-training" in html
    console.print(Text(f"Tests: {'PASS' if ok else 'FAIL'}", style="bold green" if ok else "bold red"))
    console.print("[dim]In-game: Main Menu → [5] Training Mode[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())