"""Tests for basic strategy advisor."""

from __future__ import annotations

import unittest

from countquest.card import Card
from countquest.hand import Hand
from countquest.models import Rank, Suit
from countquest.strategy import BasicStrategy, StrategyAction, dealer_upcard_value


def h(*ranks: Rank) -> Hand:
    return Hand([Card(r, Suit.SPADES) for r in ranks])


class TestDealerUpcard(unittest.TestCase):
    def test_ace_is_eleven(self) -> None:
        self.assertEqual(dealer_upcard_value(Rank.ACE), 11)


class TestHardTotals(unittest.TestCase):
    def test_stand_sixteen_vs_ten(self) -> None:
        advice = BasicStrategy.advise(
            h(Rank.TEN, Rank.SIX),
            Rank.TEN,
            can_double=False,
            can_split=False,
        )
        self.assertEqual(advice.action, StrategyAction.HIT)

    def test_stand_twelve_vs_six(self) -> None:
        advice = BasicStrategy.advise(
            h(Rank.SEVEN, Rank.FIVE),
            Rank.SIX,
            can_double=False,
            can_split=False,
        )
        self.assertEqual(advice.action, StrategyAction.STAND)

    def test_double_eleven_vs_six(self) -> None:
        advice = BasicStrategy.advise(
            h(Rank.FIVE, Rank.SIX),
            Rank.SIX,
            can_double=True,
            can_split=False,
        )
        self.assertEqual(advice.action, StrategyAction.DOUBLE)

    def test_double_eleven_falls_back_to_hit(self) -> None:
        advice = BasicStrategy.advise(
            h(Rank.FIVE, Rank.SIX),
            Rank.SIX,
            can_double=False,
            can_split=False,
        )
        self.assertEqual(advice.action, StrategyAction.HIT)


class TestSoftTotals(unittest.TestCase):
    def test_double_soft_fifteen_vs_five(self) -> None:
        advice = BasicStrategy.advise(
            h(Rank.ACE, Rank.FOUR),
            Rank.FIVE,
            can_double=True,
            can_split=False,
        )
        self.assertEqual(advice.action, StrategyAction.DOUBLE)

    def test_hit_soft_eighteen_vs_nine(self) -> None:
        advice = BasicStrategy.advise(
            h(Rank.ACE, Rank.SEVEN),
            Rank.NINE,
            can_double=True,
            can_split=False,
        )
        self.assertEqual(advice.action, StrategyAction.HIT)


class TestPairs(unittest.TestCase):
    def test_split_aces(self) -> None:
        advice = BasicStrategy.advise(
            h(Rank.ACE, Rank.ACE),
            Rank.TEN,
            can_double=False,
            can_split=True,
        )
        self.assertEqual(advice.action, StrategyAction.SPLIT)

    def test_stand_tens(self) -> None:
        advice = BasicStrategy.advise(
            h(Rank.KING, Rank.QUEEN),
            Rank.SIX,
            can_double=False,
            can_split=True,
        )
        self.assertEqual(advice.action, StrategyAction.STAND)

    def test_split_eights(self) -> None:
        advice = BasicStrategy.advise(
            h(Rank.EIGHT, Rank.EIGHT),
            Rank.TEN,
            can_double=False,
            can_split=True,
        )
        self.assertEqual(advice.action, StrategyAction.SPLIT)


if __name__ == "__main__":
    unittest.main()