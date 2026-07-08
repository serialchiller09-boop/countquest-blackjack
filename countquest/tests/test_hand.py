"""Tests for Hand evaluation, outcomes, and payouts."""

from __future__ import annotations

import unittest

from countquest.card import Card
from countquest.hand import Hand, HandResult, calculate_payout, compare_hands
from countquest.models import Rank, Suit


def c(rank: Rank, suit: Suit = Suit.SPADES) -> Card:
    """Shorthand to build a card in tests."""
    return Card(rank=rank, suit=suit)


class TestHandValues(unittest.TestCase):
    def test_soft_ace_six(self) -> None:
        hand = Hand([c(Rank.ACE), c(Rank.SIX, Suit.HEARTS)])
        self.assertEqual(hand.value(), 17)
        self.assertTrue(hand.is_soft())
        self.assertFalse(hand.is_bust())

    def test_natural_blackjack_ace_king(self) -> None:
        hand = Hand([c(Rank.ACE), c(Rank.KING)])
        self.assertEqual(hand.value(), 21)
        self.assertTrue(hand.is_blackjack())
        # Technically soft (Ace as 11), but you would never hit a natural.
        self.assertTrue(hand.is_soft())

    def test_multiple_aces(self) -> None:
        hand = Hand([c(Rank.ACE), c(Rank.ACE, Suit.HEARTS), c(Rank.NINE)])
        self.assertEqual(hand.value(), 21)
        self.assertFalse(hand.is_bust())

    def test_bust_with_aces(self) -> None:
        hand = Hand(
            [
                c(Rank.ACE),
                c(Rank.FIVE),
                c(Rank.NINE),
                c(Rank.EIGHT, Suit.DIAMONDS),
            ]
        )
        self.assertEqual(hand.value(), 23)
        self.assertTrue(hand.is_bust())

    def test_blackjack_detection(self) -> None:
        bj = Hand([c(Rank.ACE), c(Rank.QUEEN)])
        self.assertTrue(bj.is_blackjack())
        not_bj = Hand([c(Rank.NINE), c(Rank.TWO), c(Rank.QUEEN)])
        self.assertFalse(not_bj.is_blackjack())

    def test_hit_adds_card(self) -> None:
        hand = Hand([c(Rank.TEN), c(Rank.SIX)])
        hand.add(c(Rank.FIVE))
        self.assertEqual(hand.value(), 21)
        self.assertEqual(hand.size, 3)


class TestOutcomes(unittest.TestCase):
    def test_player_blackjack_beats_dealer_twenty(self) -> None:
        player = Hand([c(Rank.ACE), c(Rank.JACK)])
        dealer = Hand([c(Rank.TEN), c(Rank.QUEEN)])
        self.assertEqual(compare_hands(player, dealer), HandResult.BLACKJACK)

    def test_both_blackjack_push(self) -> None:
        player = Hand([c(Rank.ACE), c(Rank.KING)])
        dealer = Hand([c(Rank.ACE), c(Rank.QUEEN, Suit.HEARTS)])
        self.assertEqual(compare_hands(player, dealer), HandResult.PUSH)

    def test_player_bust_loses_immediately(self) -> None:
        player = Hand([c(Rank.TEN), c(Rank.NINE), c(Rank.FIVE)])
        dealer = Hand([c(Rank.TEN), c(Rank.SIX)])
        self.assertEqual(compare_hands(player, dealer), HandResult.LOSS)

    def test_dealer_bust_player_wins(self) -> None:
        player = Hand([c(Rank.TEN), c(Rank.EIGHT)])
        dealer = Hand([c(Rank.TEN), c(Rank.NINE), c(Rank.FIVE)])
        self.assertEqual(compare_hands(player, dealer), HandResult.WIN)

    def test_push_equal_totals(self) -> None:
        player = Hand([c(Rank.TEN), c(Rank.SEVEN)])
        dealer = Hand([c(Rank.NINE), c(Rank.EIGHT)])
        self.assertEqual(compare_hands(player, dealer), HandResult.PUSH)

    def test_player_higher_total_wins(self) -> None:
        player = Hand([c(Rank.TEN), c(Rank.NINE)])
        dealer = Hand([c(Rank.TEN), c(Rank.SEVEN)])
        self.assertEqual(compare_hands(player, dealer), HandResult.WIN)

    def test_player_lower_total_loses(self) -> None:
        player = Hand([c(Rank.TEN), c(Rank.SIX)])
        dealer = Hand([c(Rank.TEN), c(Rank.EIGHT)])
        self.assertEqual(compare_hands(player, dealer), HandResult.LOSS)


class TestPayouts(unittest.TestCase):
    def test_blackjack_pays_three_to_two(self) -> None:
        self.assertEqual(calculate_payout(100, HandResult.BLACKJACK), 150)

    def test_win_pays_one_to_one(self) -> None:
        self.assertEqual(calculate_payout(50, HandResult.WIN), 50)

    def test_push_zero(self) -> None:
        self.assertEqual(calculate_payout(25, HandResult.PUSH), 0)

    def test_loss_negative_bet(self) -> None:
        self.assertEqual(calculate_payout(40, HandResult.LOSS), -40)


if __name__ == "__main__":
    unittest.main()