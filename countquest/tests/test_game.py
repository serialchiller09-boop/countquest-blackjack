"""Tests for dealer rules and settlement helpers."""

from __future__ import annotations

import unittest

from countquest.card import Card
from countquest.game import (
    Game,
    PlayerHandState,
    _dealer_should_hit,
    _result_for_hand,
)
from countquest.hand import Hand, HandResult
from countquest.models import Rank, Suit


def c(rank: Rank, suit: Suit = Suit.SPADES) -> Card:
    return Card(rank=rank, suit=suit)


class TestDealerRules(unittest.TestCase):
    def test_hit_sixteen(self) -> None:
        hand = Hand([c(Rank.TEN), c(Rank.SIX)])
        self.assertTrue(_dealer_should_hit(hand))

    def test_stand_hard_seventeen(self) -> None:
        hand = Hand([c(Rank.TEN), c(Rank.SEVEN)])
        self.assertFalse(_dealer_should_hit(hand))

    def test_hit_soft_seventeen(self) -> None:
        hand = Hand([c(Rank.ACE), c(Rank.SIX)])
        self.assertTrue(_dealer_should_hit(hand))


class TestSplitResults(unittest.TestCase):
    def test_split_blackjack_pays_as_win_not_three_to_two(self) -> None:
        player_state = PlayerHandState(
            hand=Hand([c(Rank.ACE), c(Rank.KING)]),
            bet=10,
            is_from_split=True,
        )
        dealer = Hand([c(Rank.TEN), c(Rank.NINE)])
        self.assertEqual(_result_for_hand(player_state, dealer), HandResult.WIN)


class TestBankrollSettlement(unittest.TestCase):
    def test_blackjack_increases_bankroll(self) -> None:
        game = Game(bankroll=1000)
        state = PlayerHandState(
            hand=Hand([c(Rank.ACE), c(Rank.QUEEN)]),
            bet=100,
        )
        game.dealer = Hand([c(Rank.TEN), c(Rank.NINE)])
        game.bankroll -= state.bet
        game._settle_hand(state, reveal_dealer=False)
        self.assertEqual(game.bankroll, 1000 + 150)


if __name__ == "__main__":
    unittest.main()