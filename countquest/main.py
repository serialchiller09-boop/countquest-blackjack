"""
Application entry point for CountQuest Blackjack console play.
"""

from __future__ import annotations

from countquest.game import Game
from countquest.progression import ProgressionManager
from countquest.save_data import SaveData
from countquest.terminal import Ansi, paint, supports_color


def _c(text: str, *codes: str) -> str:
    return paint(text, *codes, use_color=supports_color())


def _print_startup_menu(save: SaveData, has_file: bool) -> None:
    print()
    print(_c("═" * 52, Ansi.CYAN))
    print(_c("  CountQuest Blackjack", Ansi.BOLD, Ansi.CYAN))
    print(_c("  Hi-Lo card counting trainer", Ansi.DIM))
    print(_c("═" * 52, Ansi.CYAN))

    if has_file:
        stats = save.stats
        mode = "Practice ∞" if save.settings.practice_mode else f"${save.bankroll:,}"
        session_note = ""
        if save.session_active:
            session_note = _c(
                f"  ↳ Saved session: {mode} | {save.session_hands} hands this visit",
                Ansi.GREEN,
            )
        print(
            f"\n  Saved progress: {stats.rank_enum.title} | "
            f"Level {stats.help_level} | {stats.hands_played} lifetime hands"
        )
        if session_note:
            print(session_note)
    else:
        print(_c("\n  No saved progress yet — start fresh!", Ansi.DIM))

    print()
    options: list[tuple[str, str, bool]] = []

    if save.session_active and has_file:
        label = "Continue previous session"
        if save.settings.practice_mode:
            detail = f"Practice (${save.bankroll:,} tracked)"
        else:
            detail = f"Bankroll ${save.bankroll:,}"
        options.append(("1", f"{label} — {detail}", True))
        base = 2
    else:
        base = 1

    options.extend([
        (str(base), "Full Game — $1,000 bankroll, real stakes", True),
        (str(base + 1), "Practice Mode — ∞ chips, counting focus", True),
        (str(base + 2), "Reset progress — wipe stats & settings", has_file),
        ("q", "Quit", True),
    ])

    for key, label, enabled in options:
        if not enabled:
            continue
        print(f"  [{_c(key, Ansi.YELLOW, Ansi.BOLD)}] {label}")

    print()


def _read_menu_choice(save: SaveData, has_file: bool) -> str:
    if save.session_active and has_file:
        valid = {"1", "2", "3", "4", "q", "quit"}
        prompt = "Choice [1-4 / q]: "
    else:
        valid = {"1", "2", "3", "q", "quit"}
        prompt = "Choice [1-3 / q]: "

    while True:
        raw = input(prompt).strip().lower()
        if raw in {"quit", "exit"}:
            return "q"
        if raw in valid:
            return raw
        print("  Invalid choice — try again.")


def main() -> None:
    """Show startup menu and launch the selected game mode."""
    progression = ProgressionManager()
    has_file = progression.exists()

    while True:
        save = progression.load_save()
        _print_startup_menu(save, has_file)
        choice = _read_menu_choice(save, has_file)

        if choice == "q":
            print("\nSee you at the tables.\n")
            return

        resume_key = "1" if save.session_active and has_file else None

        if choice == resume_key:
            Game.from_save(save, progression).run()
        elif choice == str(1 if resume_key is None else 2):
            Game.new_session(practice=False, progression=progression).run()
        elif choice == str(2 if resume_key is None else 3):
            Game.new_session(practice=True, progression=progression).run()
        elif choice == str(3 if resume_key is None else 4):
            if progression.reset_progress():
                print(_c("\n  ✓ Progress deleted.", Ansi.GREEN))
                has_file = False
            else:
                print("\n  Nothing to reset.")
        else:
            print("  Invalid choice.")

        has_file = progression.exists()
        print()


if __name__ == "__main__":
    main()