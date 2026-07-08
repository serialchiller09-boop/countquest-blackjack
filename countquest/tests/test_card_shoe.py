"""Tests for Card and Shoe foundations."""

from __future__ import annotations

import unittest

from countquest.card import Card
from countquest.deck import Shoe
from countquest.models import Rank, Suit


class TestCard(unittest.TestCase):
    def test_hi_lo_low_card(self) -> None:
        self.assertEqual(Card(Rank.FIVE, Suit.SPADES).hi_lo_value(), 1)

    def test_hi_lo_neutral_card(self) -> None:
        self.assertEqual(Card(Rank.EIGHT, Suit.HEARTS).hi_lo_value(), 0)

    def test_hi_lo_high_card(self) -> None:
        self.assertEqual(Card(Rank.KING, Suit.CLUBS).hi_lo_value(), -1)
        self.assertEqual(Card(Rank.ACE, Suit.DIAMONDS).hi_lo_value(), -1)


class TestShoe(unittest.TestCase):
    def test_six_deck_size(self) -> None:
        shoe = Shoe(num_decks=6, burn_on_shuffle=False)
        self.assertEqual(shoe.initial_count, 312)
        self.assertEqual(shoe.cards_remaining, 312)

    def test_burn_reduces_remaining(self) -> None:
        shoe = Shoe(num_decks=1, burn_on_shuffle=True)
        self.assertEqual(shoe.initial_count, 52)
        self.assertEqual(shoe.cards_remaining, 51)
        self.assertEqual(len(shoe.burned_cards), 1)

    def test_needs_reshuffle_at_penetration(self) -> None:
        shoe = Shoe(num_decks=1, penetration=0.75, burn_on_shuffle=False)
        # Deal until 25% or fewer remain (13 cards on a 52-card shoe)
        while shoe.remaining_fraction() > 0.25:
            shoe.deal()
        self.assertTrue(shoe.needs_reshuffle())

    def test_reset_rebuilds_shoe(self) -> None:
        shoe = Shoe(num_decks=2, burn_on_shuffle=False)
        for _ in range(40):
            shoe.deal()
        shoe.reset()
        self.assertEqual(shoe.cards_remaining, 104)


if __name__ == "__main__":
    unittest.main()