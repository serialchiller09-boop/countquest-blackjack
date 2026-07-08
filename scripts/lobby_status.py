#!/usr/bin/env python3
"""Rich status reporter for Plan 21 lobby rebuild."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

ROOT = Path(__file__).resolve().parents[1]
console = Console()

sys.path.insert(0, str(ROOT / "scripts"))
from load_project_source import load_app_source  # noqa: E402
from save_version import read_save_version  # noqa: E402

PHASE1_FEATURES = [
    ("lobby-clubs-btn", "Large standalone Clubs button (left topbar)", "8BP layout"),
    ("lobby-hero-play", "Circular hero Play 1v1 button", "8BP layout"),
    ("lobby-secondary-left", "Side play mode buttons (left)", "8BP layout"),
    ("lobby-secondary-right", "Side play mode buttons (right)", "8BP layout"),
    ("lobby-xp-bar", "Profile XP progress bar", "8BP profile"),
    ("lobby-currency-buy", "Chips/Gems + buy buttons", "8BP currencies"),
    ("lobby-pass-timer live", "CountQuest Pass countdown", "Live timer"),
    ("lobby-bottom-dock", "Fixed bottom minigame dock", "8BP rewards row"),
    ("lobby-spin-wheel", "Visual spin wheel minigame", "Minigame UI"),
    ("lobby-scratch-grid", "Interactive scratch tiles", "Minigame UI"),
]


def main() -> int:
    html = load_app_source()
    console.print()
    console.print(
        Panel(
            "[bold]Plan 21 Lobby Rebuild[/]\n[dim]Production 8 Ball Pool-style home screen[/]",
            title="[bold gold1]Phase Status[/]",
            border_style="bright_green",
            padding=(1, 2),
        )
    )
    console.print()

    feat = Table(title="Phase 1 — Lobby Features", box=box.ROUNDED, border_style="cyan")
    feat.add_column("Feature ID", style="cyan")
    feat.add_column("Description", style="white")
    feat.add_column("8BP Match", style="dim")
    feat.add_column("Built", justify="center")
    for fid, desc, match in PHASE1_FEATURES:
        key = fid.split()[0]
        built = key in html or (fid == "lobby-pass-timer live" and "startLobbyPassTimer" in html)
        feat.add_row(fid, desc, match, "[green]✓[/]" if built else "[red]✗[/]")
    console.print(feat)
    console.print()

    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    ver = read_save_version()
    tests = Table(title="Verification", box=box.SIMPLE)
    tests.add_column("Check", style="white")
    tests.add_column("Result", justify="center")
    tests.add_row(f"SAVE_VERSION {ver or '?'}", "[green]OK[/]" if ver else "[red]FAIL[/]")
    tests.add_row("run_web_tests.py", "[green]PASS[/]" if proc.returncode == 0 else "[red]FAIL[/]")
    tests.add_row("lobby-8bp container", "[green]OK[/]" if "lobby-8bp" in html else "[red]FAIL[/]")
    console.print(tests)
    console.print()
    if proc.returncode != 0:
        console.print(Text(proc.stdout + proc.stderr, style="red"))
    return 0 if proc.returncode == 0 and ver else 1


if __name__ == "__main__":
    raise SystemExit(main())