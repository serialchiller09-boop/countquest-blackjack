// §2 CORE TYPES — cards, hands, shoe
// ═══════════════════════════════════════════════════════════════
/** Build a plain { rank, suit } object. Ranks: 2–9, 10, J, Q, K, A. */
const createPlayingCard = (rank, suit) => ({ rank: rank === 'T' ? '10' : rank, suit });
const formatCardLabel = (playingCard) => `${playingCard.rank}${SUIT_SYM[playingCard.suit]}`;
const isTenValueRank = (rank) => TEN_VALUE_RANKS.has(rank) || rank === 'T';
const isAceRank = (rank) => rank === 'A';

class Hand {
  constructor(cards = []) { this.cards = [...cards]; }
  add(c) { this.cards.push(c); }
  clear() { this.cards.length = 0; }
  get size() { return this.cards.length; }
  rawValue() {
    let total = 0, aces = 0;
    for (const c of this.cards) {
      if (isAceRank(c.rank)) { aces++; total += 11; }
      else if (isTenValueRank(c.rank)) total += 10;
      else total += parseInt(c.rank, 10);
    }
    return { total, aces };
  }
  value() {
    let { total, aces } = this.rawValue();
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }
  isSoft() { const { total, aces } = this.rawValue(); return aces > 0 && total <= 21; }
  isBlackjack() { return this.size === 2 && this.value() === 21; }
  isBust() { return this.value() > 21; }
  is21() { return this.value() === 21; }
  summary(hideHole = false) {
    if (!this.cards.length) return '(empty)';
    if (hideHole && this.size >= 2) {
      const up = this.cards[0];
      const uv = isAceRank(up.rank) ? 11 : isTenValueRank(up.rank) ? 10 : parseInt(up.rank, 10);
      return `${formatCardLabel(up)} ?? = ${uv}+?`;
    }
    const t = this.value();
    let tag = this.isBlackjack() ? 'blackjack' : this.isBust() ? 'bust' : this.isSoft() ? 'soft' : 'hard';
    return `${this.cards.map(formatCardLabel).join(' ')} = ${t} (${tag})`;
  }

  /** Beginner-friendly hand total — no redundant suit symbols (cards already show suits). */
  beginnerDisplaySummary(hideHole = false) {
    if (!this.cards.length) return 'No cards';
    if (hideHole && this.size >= 2) {
      const up = this.cards[0];
      const uv = isAceRank(up.rank) ? 11 : isTenValueRank(up.rank) ? 10 : parseInt(up.rank, 10);
      return `Dealer shows ${up.rank} — hole card hidden (at least ${uv} points visible)`;
    }
    const t = this.value();
    if (this.isBlackjack()) return 'Blackjack!';
    if (this.isBust()) return `Bust at ${t} (over 21)`;
    if (this.isSoft()) return `Soft ${t} (Ace counts as 11)`;
    const { aces } = this.rawValue();
    const aceNote = aces > 0 ? ' (Ace counts as 1)' : '';
    return `Hard ${t}${aceNote}`;
  }
}

const FULL_DECK_TEMPLATE = [];
for (const suit of SUITS) for (const rank of RANKS) FULL_DECK_TEMPLATE.push(createPlayingCard(rank, suit));

class Shoe {
  constructor(numDecks = 6, penetration = 0.75) {
    this.numDecks = numDecks; this.penetration = penetration;
    this._cards = []; this._initial = 0; this.burnedCards = [];
    this.reset();
  }
  reset() {
    this.burnedCards = [];
    this._cards = [];
    for (let deckIndex = 0; deckIndex < this.numDecks; deckIndex++)
      this._cards.push(...FULL_DECK_TEMPLATE.map(c => createPlayingCard(c.rank, c.suit)));
    this._initial = this._cards.length;
    this.shuffle();
    if (this._cards.length) this.burnedCards.push(this._cards.shift());
  }
  shuffle() {
    for (let i = this._cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._cards[i], this._cards[j]] = [this._cards[j], this._cards[i]];
    }
  }
  deal() {
    if (!this._cards.length) throw new Error('Shoe empty');
    return this._cards.shift();
  }
  get cardsRemaining() { return this._cards.length; }
  get initialCount() { return this._initial; }
  decksRemaining() { return this.cardsRemaining ? this.cardsRemaining / 52 : 0; }
  remainingFraction() { return this._initial ? this.cardsRemaining / this._initial : 0; }
  needsReshuffle() { return this.remainingFraction() <= (1 - this.penetration); }
  summary() {
    return `${this.cardsRemaining}/${this._initial} cards (${this.decksRemaining().toFixed(2)} decks left)`;
  }

  /** Plain-English remaining cards line (qualifies casino “shoe” jargon). */
  beginnerSummary() {
    const decks = this.decksRemaining().toFixed(1);
    return `${this.cardsRemaining} cards remaining (~${decks} deck${decks === '1.0' ? '' : 's'} left in the shoe)`;
  }
}

// ═══════════════════════════════════════════════════════════════
