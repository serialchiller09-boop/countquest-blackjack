"""Harder edge-case tests: rank 10 notation, deck makeup, betting boundaries."""

from __future__ import annotations

import unittest

from countquest.betting import suggest_bet, true_count_units
from countquest.card import Card
from countquest.counter import HiLoCounter
from countquest.deck import Shoe
from countquest.hand import Hand
from countquest.models import Rank, Suit


def c(rank: Rank, suit: Suit = Suit.SPADES) -> Card:
    return Card(rank=rank, suit=suit)


class TestRankTenNotation(unittest.TestCase):
    def test_ten_rank_value_is_10_not_t(self) -> None:
        self.assertEqual(Rank.TEN.value, "10")

    def test_ten_is_ten_value_for_hand_totals(self) -> None:
        self.assertTrue(Rank.TEN.is_ten_value)
        hand = Hand([c(Rank.TEN), c(Rank.SIX)])
        self.assertEqual(hand.value(), 16)

    def test_ten_displays_as_10(self) -> None:
        self.assertEqual(str(c(Rank.TEN, Suit.HEARTS)), "10♥")

    def test_ten_is_hi_lo_high_card(self) -> None:
        self.assertEqual(c(Rank.TEN).hi_lo_value(), -1)

    def test_single_deck_has_four_tens(self) -> None:
        shoe = Shoe(num_decks=1, burn_on_shuffle=False)
        tens = sum(1 for _ in range(52) if shoe.deal().rank == Rank.TEN)
        self.assertEqual(tens, 4)

    def test_rank_enum_has_thirteen_distinct_faces(self) -> None:
        self.assertEqual(len(Rank), 13)
        values = {r.value for r in Rank}
        self.assertIn("10", values)
        self.assertNotIn("T", values)


class TestBetSpreadBoundaries(unittest.TestCase):
    def test_true_count_unit_boundaries(self) -> None:
        cases = [
            (-3.0, 1),
            (0.0, 1),
            (0.99, 1),
            (1.0, 2),
            (1.99, 2),
            (2.0, 3),
            (5.0, 6),
            (5.99, 6),
            (99.0, 6),
        ]
        for tc, expected in cases:
            with self.subTest(tc=tc):
                self.assertEqual(true_count_units(tc), expected)

    def test_suggest_bet_exact_amounts_at_tc_ladder(self) -> None:
        amounts = [
            suggest_bet(tc, bankroll=5000, unit_size=10, min_bet=10).amount
            for tc in [0.0, 1.0, 2.0, 3.0, 4.0, 5.0]
        ]
        self.assertEqual(amounts, [10, 20, 30, 40, 50, 60])

    def test_suggest_bet_bankroll_cap_wins_over_spread(self) -> None:
        sug = suggest_bet(5.0, bankroll=250, unit_size=10, min_bet=10)
        self.assertEqual(sug.amount, 25)
        self.assertTrue(sug.capped_by_bankroll)


class TestCounterHardCases(unittest.TestCase):
    def test_true_count_with_tiny_decks_remaining(self) -> None:
        counter = HiLoCounter()
        counter.running_count = 3
        shoe = Shoe(num_decks=1, burn_on_shuffle=False)
        shoe._cards = shoe._cards[:10]
        info = counter.get_count_info(shoe)
        self.assertAlmostEqual(info.decks_remaining, 10 / 52)
        self.assertAlmostEqual(info.true_count, 3 / 0.5)

    def test_full_low_card_shoe_max_running_count(self) -> None:
        counter = HiLoCounter()
        for rank in (Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX):
            for suit in Suit:
                counter.observe(Card(rank, suit))
        self.assertEqual(counter.running_count, 20)

    def test_observe_ten_decrements_count(self) -> None:
        counter = HiLoCounter()
        counter.observe(c(Rank.TEN))
        self.assertEqual(counter.running_count, -1)


if __name__ == "__main__":
    unittest.main()