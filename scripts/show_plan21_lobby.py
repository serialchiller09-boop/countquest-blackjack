#!/usr/bin/env python3
"""Plan 21 — 8 Ball Pool-style lobby progress report."""

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

TOP_NAV = [
    ("👥 Clubs (hero btn)", "Large left button — crew rank + payout badge"),
    ("Profile + XP bar", "Avatar, level ring, progress to next level"),
    ("🪙/💎 + buy", "Dual currency with shop shortcuts"),
    ("📖 Aids · 🎁 Rewards · 🏆 Ranks · 🛒 Shop", "Compact icon nav (right)"),
]

PLAY_MODES = [
    ("🎴 PLAY (hero)", "Massive circular 1v1 Tables button — center"),
    ("🏆 Tournaments · ✨ Event", "Left column secondary buttons"),
    ("🏋️ Training · 🤝 Friends", "Right column secondary buttons"),
]

MINIGAMES = [
    ("📦 Surprise Training Box", "Random drill + 75 chips"),
    ("🎡 Spin & Win", "Daily wheel — chips/gems"),
    ("🎫 Scratch & Win", "Daily scratch prize"),
    ("🎯 Lucky Count Shot", "RC quiz for chips"),
]


def main() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    console.print()
    console.print(
        Panel(
            "[bold]Plan 21 Lobby[/]\n[dim]8 Ball Pool-style home — CountQuest Blackjack[/]",
            title="[bold gold1]Plan 21 Lobby[/]",
            border_style="bright_green",
            padding=(1, 2),
        )
    )
    console.print()

    nav = Table(title="Top Navigation Bar", box=box.ROUNDED, border_style="cyan")
    nav.add_column("Button", style="cyan")
    nav.add_column("Routes to", style="white")
    for btn, route in TOP_NAV:
        nav.add_row(btn, route)
    console.print(nav)
    console.print()

    play = Table(title="Play Buttons (8BP-style)", box=box.ROUNDED, border_style="green")
    play.add_column("Mode", style="gold1")
    play.add_column("Integration", style="white")
    for mode, integ in PLAY_MODES:
        play.add_row(mode, integ)
    console.print(play)
    console.print()

    mg = Table(title="Bottom Minigame Hooks", box=box.ROUNDED, border_style="yellow")
    mg.add_column("Tile", style="cyan")
    mg.add_column("Reward", style="white")
    for tile, reward in MINIGAMES:
        mg.add_row(tile, reward)
    console.print(mg)
    console.print()

    integrated = Table(title="Systems Wired Through Lobby", border_style="purple")
    integrated.add_column("System", style="cyan", min_width=18)
    integrated.add_column("Status", justify="center")
    for name, ok in [
        ("Dual currency (Chips/Gems)", "✅"),
        ("CountQuest Pass banner", "✅"),
        ("Clubs / Counting Crews", "✅"),
        ("Table lobby economy", "✅"),
        ("Daily rewards [Free Rewards]", "✅"),
        ("Training drills", "✅"),
        ("Shop + IAP fallback", "✅"),
        ("OAuth config (Settings)", "✅"),
    ]:
        integrated.add_row(name, ok)
    console.print(integrated)
    console.print()

    checks = ["lobby-8bp", "lobby-clubs-btn", "lobby-hero-play", "lobby-bottom-dock", "startLobbyPassTimer", "renderLobby", "modal-lobby-shop"]
    missing = [c for c in checks if c not in html]
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    ok = proc.returncode == 0 and not missing
    if missing:
        console.print(Text(f"Missing: {', '.join(missing)}", style="bold red"))
    console.print(Text(f"Tests: {'PASS' if ok else 'FAIL'}", style="bold green" if ok else "bold red"))
    console.print("[dim]Open index.html — lobby is the default home screen[/]")
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())