"""
Full save file schema — stats, bankroll, settings, resumable session.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from countquest.stats import PlayerStats

SAVE_VERSION = 1
PRACTICE_BANKROLL = 50_000


@dataclass
class GameSettings:
    """Player preferences persisted across sessions."""

    practice_mode: bool = False
    clear_screen: bool = True
    use_color: bool = True
    num_decks: int = 6
    starting_bankroll: int = 1000
    min_bet: int = 10
    unit_size: int = 10


@dataclass
class SaveData:
    """
    Contents of ``data/progress.json``.

    Auto-saved after every hand so crashes rarely lose progress.
    """

    version: int = SAVE_VERSION
    stats: PlayerStats = field(default_factory=PlayerStats)
    bankroll: int = 1000
    settings: GameSettings = field(default_factory=GameSettings)
    session_active: bool = False
    session_start_bankroll: int = 0
    session_hands: int = 0
    session_net_pl: int = 0

    def mark_session_start(self, bankroll: int) -> None:
        self.session_active = True
        self.session_start_bankroll = bankroll
        self.session_hands = 0
        self.session_net_pl = 0
        self.bankroll = bankroll

    def mark_session_end(self) -> None:
        self.session_active = False

    def update_session(self, *, hands: int, net_pl: int, bankroll: int) -> None:
        self.session_hands = hands
        self.session_net_pl = net_pl
        self.bankroll = bankroll