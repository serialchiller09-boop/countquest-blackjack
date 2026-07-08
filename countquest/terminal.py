"""
ANSI terminal helpers — colors and screen clearing.

Falls back to plain text when color is disabled or the terminal lacks support.
"""

from __future__ import annotations

import os
import sys


class Ansi:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"
    BG_GREEN = "\033[42m"
    BG_RED = "\033[41m"


def enable_ansi_windows() -> None:
    """Enable VT100 escape sequences on Windows 10+."""
    if sys.platform != "win32":
        return
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        handle = kernel32.GetStdHandle(-11)
        mode = ctypes.c_ulong()
        kernel32.GetConsoleMode(handle, ctypes.byref(mode))
        mode.value |= 4
        kernel32.SetConsoleMode(handle, mode)
    except Exception:
        pass


def supports_color() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    if not hasattr(sys.stdout, "isatty") or not sys.stdout.isatty():
        return False
    if sys.platform == "win32":
        enable_ansi_windows()
    return True


def paint(text: str, *codes: str, use_color: bool = True) -> str:
    if not use_color or not codes:
        return text
    return "".join(codes) + text + Ansi.RESET


def clear_screen() -> None:
    if sys.platform == "win32":
        os.system("cls")
    else:
        print("\033[2J\033[H", end="")