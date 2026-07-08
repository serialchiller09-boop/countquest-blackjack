"""Tests for Hi-Lo counter and accuracy tracker."""

from __future__ import annotations

import unittest

from countquest.card import Card
from countquest.counter import CountAccuracyTracker, HiLoCounter
from countquest.deck import Shoe
from countquest.models import Rank, Suit


class TestHiLoCounter(unittest.TestCase):
    def test_observe_low_and_high(self) -> None:
        counter = HiLoCounter()
        counter.observe(Card(Rank.FIVE, Suit.SPADES))
        counter.observe(Card(Rank.KING, Suit.HEARTS))
        self.assertEqual(counter.running_count, 0)
        self.assertEqual(counter.cards_seen, 2)

    def test_true_count_uses_decks_remaining(self) -> None:
        counter = HiLoCounter()
        for _ in range(4):
            counter.observe(Card(Rank.TWO, Suit.CLUBS))  # +1 each → +4

        shoe = Shoe(num_decks=1, burn_on_shuffle=False)
        # Remove 4 cards from shoe to mirror observes (simplified)
        info = counter.get_count_info(shoe)
        self.assertEqual(info.running_count, 4)
        self.assertAlmostEqual(info.decks_remaining, 1.0)
        self.assertAlmostEqual(info.true_count, 4.0)

    def test_true_count_with_partial_deck(self) -> None:
        counter = HiLoCounter()
        counter.running_count = 6
        shoe = Shoe(num_decks=6, burn_on_shuffle=False)
        # Simulate 5.5 decks dealt → 0.5 decks left
        shoe._cards = shoe._cards[:26]  # 26 cards = 0.5 deck
        info = counter.get_count_info(shoe)
        self.assertAlmostEqual(info.decks_remaining, 0.5)
        self.assertAlmostEqual(info.true_count, 12.0)

    def test_reset_clears_state(self) -> None:
        counter = HiLoCounter()
        counter.observe(Card(Rank.ACE, Suit.SPADES))
        counter.reset()
        self.assertEqual(counter.running_count, 0)
        self.assertEqual(counter.cards_seen, 0)


class TestCountAccuracy(unittest.TestCase):
    def test_within_tolerance_counts_correct(self) -> None:
        tracker = CountAccuracyTracker(tolerance=1)
        self.assertTrue(tracker.record_guess(5, 6))
        self.assertFalse(tracker.record_guess(3, 6))
        self.assertEqual(tracker.correct_guesses, 1)
        self.assertEqual(tracker.total_guesses, 2)


if __name__ == "__main__":
    unittest.main()