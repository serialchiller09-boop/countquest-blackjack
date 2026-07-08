#!/usr/bin/env python3
"""Plan 21 quality polish pass — before/after Rich report."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from load_project_source import load_app_source  # noqa: E402
from save_version import read_save_version  # noqa: E402

console = Console()

POLISH_IMPROVEMENTS = [
    ("Lobby hero Play", "Static green disc", "Breathing glow + scale hover + whoosh sound"),
    ("Pass banner", "Flat gradient bar", "Shimmer sweep + sparkle tap sound"),
    ("Secondary play tiles", "Active-press only", "Hover lift + brightness + whoosh on tap"),
    ("Free Rewards badge", "Static red dot", "Pulsing badge + sparkle when reward ready"),
    ("Minigame dock (ready)", "Gold border only", "Pulsing glow + reward sound on open"),
    ("Currency pills", "Instant text swap", "Bump animation when chips/gems change"),
    ("Screen navigation", "Instant show/hide", "Fade-up screen-enter transition"),
    ("Lobby modals", "Plain dialog open", "Scale-in + blurred backdrop (dialog-premium)"),
    ("Toasts", "Text-only bars", "Type icons + backdrop blur + win/level sounds"),
    ("Lobby taps", "Silent clicks", "tap / whoosh / reward / sparkle + light haptic"),
    ("Continue session", "Plain emerald button", "Pulsing gradient CTA with whoosh"),
    ("Mode cards", "Basic hover", "Lift + gold border glow shadow"),
    ("Action buttons", "No hover state", "Brightness lift + press feedback"),
    ("Focus rings", "Browser default", "Gold focus-visible on all buttons"),
    ("Motion safety", "Always animated", "prefers-reduced-motion disables lobby loops"),
    ("Beginner hint", "Generic copy", "Warmer welcome + glowing Play callout"),
    ("Leaderboards modal", "Crew-only subtitle", "Global crews · crew · stats subtitle"),
    ("Lobby ambience", "Flat felt gradient", "Ambient color orbs (purple/gold/green)"),
]

POLISH_MARKERS = [
    "heroGlow",
    "passShimmer",
    "lobbyTapFeedback",
    "showModalPremium",
    "screen-enter",
    "currency-bump",
    "dialog-premium",
    "prefers-reduced-motion",
    "case 'tap':",
    "case 'whoosh':",
    "case 'reward':",
    "case 'sparkle':",
    "lobby-continue-btn",
    "minigameReady",
]


def run_tests() -> tuple[bool, int]:
    proc = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "run_web_tests.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    count = 0
    for line in (proc.stdout + proc.stderr).splitlines():
        if line.strip().startswith("Ran ") and "tests" in line:
            try:
                count = int(line.split()[1])
            except (IndexError, ValueError):
                pass
    return proc.returncode == 0, count


def main() -> int:
    html = load_app_source()
    test_ok, test_count = run_tests()
    save_ver = read_save_version() or "?"
    markers_ok = sum(1 for m in POLISH_MARKERS if m in html)

    console.print()
    console.print(
        Panel(
            "[bold]Premium polish pass[/] — animations, micro-interactions, 8BP lobby feel\n"
            f"[dim]SAVE_VERSION {save_ver} · Plan 21 quality layer[/]",
            title="[bold gold1]CountQuest Polish Status[/]",
            border_style="bright_magenta",
            padding=(1, 2),
        )
    )
    console.print()

    meta = Table(box=box.SIMPLE, show_header=False)
    meta.add_column("Key", style="dim")
    meta.add_column("Value")
    meta.add_row("Project", str(ROOT))
    meta.add_row("SAVE_VERSION", save_ver)
    meta.add_row("Tests", f"{test_count} {'PASS' if test_ok else 'FAIL'}")
    meta.add_row("Polish markers", f"{markers_ok}/{len(POLISH_MARKERS)}")
    meta.add_row("Verify", "python scripts/open_game.py")
    console.print(meta)
    console.print()

    before = Table(
        title="Before → After (Quality Polish)",
        box=box.ROUNDED,
        border_style="cyan",
        show_lines=True,
    )
    before.add_column("Area", style="cyan", min_width=18)
    before.add_column("Before", style="dim")
    before.add_column("After", style="green")
    for area, old, new in POLISH_IMPROVEMENTS:
        before.add_row(area, old, new)
    console.print(before)
    console.print()

    checks = Table(title="Implementation Checks", box=box.ROUNDED, border_style="yellow")
    checks.add_column("Marker", style="gold1")
    checks.add_column("Status", justify="center")
    for m in POLISH_MARKERS:
        checks.add_row(m, "[green]✓[/]" if m in html else "[red]✗[/]")
    console.print(checks)
    console.print()

    ok = test_ok and markers_ok == len(POLISH_MARKERS)
    console.print(
        f"[bold]{'✓ Polish pass COMPLETE' if ok else '✗ Verification FAILED'}[/]  "
        f"[dim]python scripts/polish_status.py[/]"
    )
    console.print()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())