    proto.dealNextHand = async function (lastBet) {
      this.clearAutoNextHandTimer();
      this._awaitingNextHand = false;
      if (this.isDealLocked()) return;
      var prefer = lastBet ?? this.roundReview?.bet ?? this.betSuggestion?.amount ?? this.minBet;
      this.beginBetPhase();
      if (this.phase !== 'bet' && this.phase !== 'countConfirm') return;
      var betInput = document.getElementById('bet-input');
      if (betInput && prefer != null) {
        betInput.value = prefer;
        if (typeof this.updateSeatBetIndicator === 'function') this.updateSeatBetIndicator(prefer);
        else if (typeof updateCasinoSeatBetChipVisual === 'function') updateCasinoSeatBetChipVisual(prefer);
      }
      // Auto-flow: if auto-play is enabled, proceed directly to placeBet
      if (this.shouldAutoFlowHands && this.shouldAutoFlowHands()) {
        if (typeof this.placeBet === 'function') {
          try {
            await this.placeBet(prefer);
          } catch (e) {
            console.warn('dealNextHand auto-flow placeBet error:', e);
          }
        }
      }
    };
