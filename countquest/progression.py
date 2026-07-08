"""
Persist full game state to ``data/progress.json``.

Supports migration from older saves that stored only ``PlayerStats`` fields.
"""

from __future__ import annotations

import json
from dataclasses import asdict, fields
from pathlib import Path

from countquest.save_data import SAVE_VERSION, GameSettings, SaveData
from countquest.stats import PlayerStats

_DEFAULT_PROGRESS_PATH = Path(__file__).resolve().parents[1] / "data" / "progress.json"


def _stats_field_names() -> set[str]:
    return {f.name for f in fields(PlayerStats)}


def _is_legacy_stats_only(data: dict) -> bool:
    """True when JSON is a flat PlayerStats blob (no version key)."""
    if "version" in data or "stats" in data:
        return False
    stats_keys = _stats_field_names()
    return bool(stats_keys & set(data.keys()))


def _parse_save(data: dict) -> SaveData:
    """Build ``SaveData`` from raw JSON, migrating legacy formats."""
    if _is_legacy_stats_only(data):
        valid = _stats_field_names()
        filtered = {k: v for k, v in data.items() if k in valid}
        return SaveData(stats=PlayerStats(**filtered))

    stats_raw = data.get("stats", {})
    if isinstance(stats_raw, dict):
        valid = _stats_field_names()
        stats = PlayerStats(**{k: v for k, v in stats_raw.items() if k in valid})
    else:
        stats = PlayerStats()

    settings_raw = data.get("settings", {})
    if isinstance(settings_raw, dict):
        valid_settings = {f.name for f in fields(GameSettings)}
        settings = GameSettings(
            **{k: v for k, v in settings_raw.items() if k in valid_settings}
        )
    else:
        settings = GameSettings()

    return SaveData(
        version=int(data.get("version", SAVE_VERSION)),
        stats=stats,
        bankroll=int(data.get("bankroll", settings.starting_bankroll)),
        settings=settings,
        session_active=bool(data.get("session_active", False)),
        session_start_bankroll=int(data.get("session_start_bankroll", 0)),
        session_hands=int(data.get("session_hands", 0)),
        session_net_pl=int(data.get("session_net_pl", 0)),
    )


class ProgressionManager:
    """Load/save full game progress."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or _DEFAULT_PROGRESS_PATH

    def exists(self) -> bool:
        return self.path.exists()

    def load_save(self) -> SaveData:
        if not self.path.exists():
            return SaveData()
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return SaveData()
            return _parse_save(data)
        except (json.JSONDecodeError, TypeError, ValueError):
            return SaveData()

    def save_save(self, save: SaveData) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": save.version,
            "stats": asdict(save.stats),
            "bankroll": save.bankroll,
            "settings": asdict(save.settings),
            "session_active": save.session_active,
            "session_start_bankroll": save.session_start_bankroll,
            "session_hands": save.session_hands,
            "session_net_pl": save.session_net_pl,
        }
        self.path.write_text(
            json.dumps(payload, indent=2),
            encoding="utf-8",
        )

    def reset_progress(self) -> bool:
        """Delete save file. Returns True if a file was removed."""
        if not self.path.exists():
            return False
        self.path.unlink()
        return True

    # --- backward-compatible API used by older code paths ---

    def load(self) -> PlayerStats:
        return self.load_save().stats

    def save(self, stats: PlayerStats) -> None:
        save = self.load_save()
        save.stats = stats
        self.save_save(save)


# Alias for older imports
PlayerProgress = PlayerStats