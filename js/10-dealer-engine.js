// §10 DEALER FRANCHISE ENGINE — mood, relationship, dialogue packs
// ═══════════════════════════════════════════════════════════════

const FRANCHISE_DEALER_DEFAULT_ID = 'margaret-hawthorne';

const FRANCHISE_READ_GUESSES = new Set(['strong', 'weak', 'bluffing']);

const MARGARET_PROFILE = {
  id: 'margaret-hawthorne',
  displayName: 'Margaret "Mags" Hawthorne',
  venue: 'Grosvenor Victoria, London',
  moodModel: { default: 'neutral' },
  relationship: {
    tiers: [
      { id: 'stranger', min: 0 },
      { id: 'regular', min: 25 },
      { id: 'favourite', min: 60 },
      { id: 'inner_circle', min: 90 },
    ],
  },
};

const MARGARET_LINES = {
  'session.start.stranger': [
    "Evening. I'm Mags. Seat four — that's you, yeah?",
    "Place your bets when you're ready. I'll wait, but the shoe won't.",
  ],
  'session.start.regular': [
    "Back again. Alright. Let's see if tonight's kinder than Tuesday.",
    "{playerName}, seat four. Shoe's fresh — don't get sentimental.",
  ],
  'bet.prompt.neutral': ['Bets in.', "Table's open."],
  'deal.start': ['No more bets. Dealing.'],
  'deal.upcard.ace': ["Ace for the house. Insurance's on offer."],
  'insurance.offer': ["Insurance pays two to one. Even money if you're nervous."],
  'peek.no_bj': ["…No. We're live."],
  'peek.dealer_bj': ['Blackjack. Sorry, darlings — house has it.'],
  'player.idle.irritated': [
    "Clock's ticking on seat four.",
    "I've dealt to slower trains.",
  ],
  'dealer.stand.17': ['Seventeen. Dealer stands.'],
  'settle.player_win': ["House pays. Don't spend it all at once."],
  'settle.player_loss': ["Rough one. Tomorrow's a different shoe."],
  'settle.push': ['Push. Nobody wins, nobody cries.'],
  'settle.player_blackjack': ['Blackjack. Fair play — house pays.'],
  'tell.lovely': ['Lovely.', "That's a lovely start for the house."],
  'read.correct': ['You saw it.', 'Sharp eyes, love.', '…Right on the tell.'],
  'read.wrong': ["Mind your own cards, love.", "That's not what I was giving you.", 'Reckon you misread me.'],
  'mood.to_warm': ["Alright. You're alright."],
  'mood.to_stiff': ["Let's keep it professional."],
  'mood.to_irritated': ["We're not here to admire the ceiling."],
  'mood.to_impressed': ['…Sharp. Didn't expect that.'],
  'chapter.beat_01': [
    "First time at Victoria? Graveyard shift's the honest shift. Fewer suits, more stories.",
  ],
};

class DealerFranchiseEngine {
  constructor(profile, lines, saveSlot = {}) {
    this.profile = profile;
    this.lines = lines;
    this.mood = saveSlot.mood || profile.moodModel?.default || 'neutral';
    this.relationship = typeof saveSlot.relationship === 'number' ? saveSlot.relationship : 18;
    this.sessionHands = 0;
    this.idleStrikes = 0;
    this.lastLine = '';
    this.handReadTruth = null;
    this.handReadUsed = false;
    this.handTells = { verbal: false, timing: false, physical: false };
    this.onPersist = null;
  }

  static createMargaret(saveSlot) {
    return new DealerFranchiseEngine(MARGARET_PROFILE, MARGARET_LINES, saveSlot);
  }

  tierId() {
    const tiers = this.profile.relationship?.tiers || [];
    let id = 'stranger';
    for (const t of tiers) if (this.relationship >= t.min) id = t.id;
    return id;
  }

  tierLabel() {
    const map = {
      stranger: 'Stranger',
      regular: 'Regular',
      favourite: 'Favourite',
      inner_circle: 'Inner Circle',
    };
    return map[this.tierId()] || 'Stranger';
  }

  pickLine(key, ctx = {}) {
    const pool = this.lines[key];
    if (!pool?.length) return '';
    let line = pool[Math.floor(Math.random() * pool.length)];
    const name = ctx.playerName || 'Player';
    line = line.replace(/\{playerName\}/g, name);
    this.lastLine = line;
    return line;
  }

  setMood(next) {
    if (!next || next === this.mood) return;
    this.mood = next;
    const bark = this.pickLine(`mood.to_${next}`);
    if (bark) this.lastLine = bark;
  }

  addRelationship(delta) {
    const before = this.tierId();
    this.relationship = Math.max(0, Math.min(100, this.relationship + delta));
    const after = this.tierId();
    if (after !== before) this.setMood('warm');
    this.persist();
  }

  persist() {
    this.onPersist?.({
      relationship: this.relationship,
      lastPlayedAt: new Date().toISOString(),
      mood: this.mood,
    });
  }

  computeReadTruth(dealerHand) {
    if (!dealerHand?.cards || dealerHand.cards.length < 2) return 'weak';
    const total = dealerHand.value();
    const up = dealerHand.cards[0]?.rank;
    const isBJ = dealerHand.isBlackjack();
    const strongUp = up === 'A' || (typeof isTenValueRank === 'function' && isTenValueRank(up));

    if (isBJ || total >= 17) return 'strong';
    if (strongUp) return 'bluffing';
    return 'weak';
  }

  computeTells(dealerHand) {
    if (!dealerHand?.cards || dealerHand.cards.length < 2) {
      return { verbal: false, timing: false, physical: false };
    }
    const total = dealerHand.value();
    const up = dealerHand.cards[0]?.rank;
    const isBJ = dealerHand.isBlackjack();
    const moodRel = { warm: 1.08, neutral: 1, stiff: 0.92, irritated: 0.88 }[this.mood] ?? 1;
    const strongHand = isBJ || total >= 18;
    const mustStand = typeof dealerShouldHit === 'function'
      ? !dealerShouldHit(dealerHand)
      : total >= 17;

    return {
      verbal: strongHand && Math.random() < 0.62 * moodRel,
      timing: up === 'A' && !isBJ && ['stiff', 'irritated'].includes(this.mood) && Math.random() < 0.58,
      physical: mustStand && total >= 17 && Math.random() < 0.70,
    };
  }

  beginHand(dealerHand) {
    this.handReadTruth = this.computeReadTruth(dealerHand);
    this.handReadUsed = false;
    this.handTells = this.computeTells(dealerHand);
  }

  shouldPeekPause() {
    return !!this.handTells?.timing;
  }

  shouldFeltTap() {
    return !!this.handTells?.physical;
  }

  submitRead(guess) {
    if (this.handReadUsed || !FRANCHISE_READ_GUESSES.has(guess)) return null;
    this.handReadUsed = true;
    const correct = guess === this.handReadTruth;
    const delta = correct ? 3 : -2;
    if (correct) {
      if (this.handReadTruth === 'bluffing') this.setMood('impressed');
      else if (this.mood === 'stiff') this.setMood('neutral');
      this.addRelationship(delta);
      return { correct: true, delta, line: this.pickLine('read.correct'), truth: this.handReadTruth };
    }
    this.addRelationship(delta);
    if (this.mood !== 'irritated') this.setMood('stiff');
    return { correct: false, delta, line: this.pickLine('read.wrong'), truth: this.handReadTruth };
  }

  handleEvent(event, ctx = {}) {
    this.sessionHands = ctx.sessionHands ?? this.sessionHands;

    if (event === 'session.start') {
      return this.pickLine(`session.start.${this.tierId() === 'stranger' ? 'stranger' : 'regular'}`, ctx);
    }
    if (event === 'bet.prompt') {
      return this.pickLine('bet.prompt.neutral', ctx);
    }
    if (event === 'deal.start') {
      return this.pickLine('deal.start', ctx);
    }
    if (event === 'deal.upcard.ace') {
      return this.pickLine('deal.upcard.ace', ctx);
    }
    if (event === 'insurance.offer') {
      return this.pickLine('insurance.offer', ctx);
    }
    if (event === 'peek.no_bj') {
      return this.pickLine('peek.no_bj', ctx);
    }
    if (event === 'peek.dealer_bj') {
      return this.pickLine('peek.dealer_bj', ctx);
    }
    if (event === 'player.idle') {
      this.idleStrikes++;
      if (this.idleStrikes >= 2) this.setMood('irritated');
      this.addRelationship(-1);
      return this.pickLine('player.idle.irritated', ctx);
    }
    if (event === 'dealer.stand') {
      if (this.handTells?.verbal) return this.pickLine('tell.lovely', ctx);
      return this.pickLine('dealer.stand.17', ctx);
    }
    if (event === 'settle.blackjack') {
      this.setMood('warm');
      this.addRelationship(2);
      return this.pickLine('settle.player_blackjack', ctx);
    }
    if (event === 'settle.win') {
      this.addRelationship(1);
      return this.pickLine('settle.player_win', ctx);
    }
    if (event === 'settle.loss') {
      return this.pickLine('settle.player_loss', ctx);
    }
    if (event === 'settle.push') {
      return this.pickLine('settle.push', ctx);
    }
    if (event === 'chapter.beat_01' && this.sessionHands === 3) {
      this.addRelationship(3);
      return this.pickLine('chapter.beat_01', ctx);
    }
    return '';
  }
}

if (typeof window !== 'undefined') window.DealerFranchiseEngine = DealerFranchiseEngine;