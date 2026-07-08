"""
Reference implementations mirroring index.html §3 counting/betting logic.

Used by hard web parity tests — keep in sync with index.html constants.
"""

from __future__ import annotations

KO_PIVOT_BY_DECKS: dict[int, int] = {1: 0, 2: 1, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 4}

HI_LO_LOW = frozenset({"2", "3", "4", "5", "6"})
HI_LO_NEUTRAL = frozenset({"7", "8", "9"})
KO_LOW = frozenset({"2", "3", "4", "5", "6", "7"})
KO_NEUTRAL = frozenset({"8", "9"})
TEN_VALUE = frozenset({"10", "J", "Q", "K"})


def get_ko_pivot(num_decks: int) -> int:
    d = max(1, min(8, int(num_decks) if num_decks else 6))
    return KO_PIVOT_BY_DECKS.get(d, 4)


def hi_lo_tag(rank: str) -> int:
    if rank in HI_LO_LOW:
        return 1
    if rank in HI_LO_NEUTRAL:
        return 0
    return -1


def ko_tag(rank: str) -> int:
    if rank in KO_LOW:
        return 1
    if rank in KO_NEUTRAL:
        return 0
    return -1


def bet_spread_units_true_count(true_count: float) -> int:
    if true_count <= 0:
        return 1
    return min(1 + int(true_count), 6)


def bet_spread_units_ko(running_count: int, pivot: int) -> int:
    above = running_count - pivot
    if above <= 0:
        return 1
    return min(1 + above, 6)


def normalize_rank(rank: str) -> str:
    return "10" if rank == "T" else rank


def is_ten_value_rank(rank: str) -> bool:
    return rank in TEN_VALUE or rank == "T"