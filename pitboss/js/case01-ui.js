/**
 * Case 01 UI  -  layout, briefing, controls, help levels, deal loop driver.
 */
(function (global) {
  'use strict';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function parseHelp() {
    const q = new URLSearchParams(location.search);
    if (q.has('help')) {
      const n = parseInt(q.get('help'), 10);
      if (n >= 0 && n <= 4) return n;
    }
    // Beginners: Novice by default (plain labels + fact chips).
    return 0;
  }

  function parseDebug() {
    return new URLSearchParams(location.search).get('debug') === '1';
  }

  function cash(units) {
    return `$${units * CASE01.unitCash}`;
  }

  class Case01UI {
    constructor() {
      this.helpLevel = parseHelp();
      this.debug = parseDebug();
      const seedQ = case01ParseSeedFromQuery();
      this.engine = null;
      this.timer = null;
      this.stepOnce = false;
      this.showMarksOnGraph = false;
      this._seed = seedQ != null ? seedQ : (Date.now() >>> 0);
      this._bind();
      this._buildEngine();
      this.showBriefing();
    }

    _buildEngine() {
      this.engine = new Case01Engine({
        seed: this._seed,
        debug: this.debug,
        helpLevel: this.helpLevel,
        onUpdate: (snap) => this.render(snap),
      });
    }

    _bind() {
      this.el = {
        briefing: qs('#briefing'),
        briefingBody: qs('#briefingBody'),
        briefingWarn: qs('#briefingWarn'),
        dismissBriefing: qs('#dismissBriefing'),
        clock: qs('#clock'),
        meta: qs('#meta'),
        seats: qs('#seats'),
        dealerCards: qs('#dealerCards'),
        shoeInfo: qs('#shoeInfo'),
        discardInfo: qs('#discardInfo'),
        flavor: qs('#flavor'),
        notebook: qs('#notebook'),
        notebookNote: qs('#notebookNote'),
        btnHover: qs('#btnHover'),
        btnShuffle: qs('#btnShuffle'),
        btnPeek: qs('#btnPeek'),
        btnPause: qs('#btnPause'),
        btnStep: qs('#btnStep'),
        coach: qs('#coach'),
        btnMark: qs('#btnMark'),
        btnBackOff: qs('#btnBackOff'),
        btnPass: qs('#btnPass'),
        callHint: qs('#callHint'),
        speedBtns: qsa('[data-speed]'),
        debug: qs('#debug'),
        peekModal: qs('#peekModal'),
        peekInput: qs('#peekInput'),
        peekSubmit: qs('#peekSubmit'),
        peekCancel: qs('#peekCancel'),
        dossier: qs('#dossier'),
        dossierBody: qs('#dossierBody'),
        graphCanvas: qs('#graphCanvas'),
        graphTip: qs('#graphTip'),
        btnShowMarks: qs('#btnShowMarks'),
        btnExportSeed: qs('#btnExportSeed'),
        btnReplay: qs('#btnReplay'),
      };

      this.el.dismissBriefing.addEventListener('click', () => this.dismissBriefing());
      this.el.btnPause.addEventListener('click', () => {
        this.engine.togglePause();
        if (!this.engine.paused) {
          if (this.engine.phase === 'betting') this._scheduleResolve();
          else this._scheduleNextHand();
        }
      });
      this.el.btnStep.addEventListener('click', () => {
        this.engine.paused = true;
        this._stepHand();
      });
      this.el.speedBtns.forEach((b) => {
        b.addEventListener('click', () => {
          const ms = parseInt(b.getAttribute('data-speed'), 10);
          this.engine.setSpeed(ms);
          this.el.speedBtns.forEach((x) => x.classList.toggle('active', x === b));
        });
      });
      this.el.btnMark.addEventListener('click', () => {
        if (this.engine.selectedSeatId) this.engine.markSeat(this.engine.selectedSeatId, 'cycle');
      });
      this.el.btnHover.addEventListener('click', () => {
        if (!this.engine.selectedSeatId) {
          this._toast('Select a seat first.');
          return;
        }
        this.engine.requestHover(this.engine.selectedSeatId);
      });
      this.el.btnShuffle.addEventListener('click', () => this.engine.requestShuffle());
      this.el.btnPeek.addEventListener('click', () => this.openPeek());
      this.el.peekCancel.addEventListener('click', () => this.el.peekModal.classList.add('hidden'));
      this.el.peekSubmit.addEventListener('click', () => {
        const v = parseInt(this.el.peekInput.value, 10);
        if (!Number.isFinite(v)) return;
        const res = this.engine.peekCount(v);
        this.el.peekModal.classList.add('hidden');
        if (res.message) this._toast(res.message);
      });
      this.el.btnBackOff.addEventListener('click', () => {
        if (!this.engine.selectedSeatId) {
          this._toast('Select a seat to back off.');
          return;
        }
        const r = this.engine.backOff(this.engine.selectedSeatId);
        if (r.ok) this.showDossier();
        else if (r.reason === 'too_early') this._toast('Watch at least eight hands.');
      });
      this.el.btnPass.addEventListener('click', () => {
        const r = this.engine.passTable();
        if (r.ok) this.showDossier();
        else if (r.reason === 'too_early') this._toast('Watch at least eight hands.');
      });
      this.el.btnShowMarks.addEventListener('click', () => {
        this.showMarksOnGraph = !this.showMarksOnGraph;
        this.el.btnShowMarks.textContent = this.showMarksOnGraph ? 'Hide my marks' : 'Show my marks';
        this.el.btnShowMarks.classList.toggle('active', this.showMarksOnGraph);
        if (this._lastDossier) {
          Case01Dossier.drawBetVsTcGraph(this.el.graphCanvas, this._lastDossier, {
            showMarks: this.showMarksOnGraph,
          });
        }
        this._toast(this.showMarksOnGraph ? 'Your warm/cold pins are on the graph.' : 'Marks hidden.');
      });
      this.el.btnExportSeed.addEventListener('click', () => {
        const text = `seed=${this.engine.seed}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => this._toast('Seed copied.'));
        } else {
          this._toast(text);
        }
      });
      this.el.btnReplay.addEventListener('click', () => {
        location.search = `?seed=${this.engine.seed}&help=${this.helpLevel}${this.debug ? '&debug=1' : ''}`;
      });
      this.el.graphCanvas.addEventListener('mousemove', (e) => {
        const tip = Case01Dossier.graphTooltipAt(this.el.graphCanvas, e.clientX, e.clientY);
        this.el.graphTip.textContent = tip || '';
      });
    }

    _toast(msg) {
      this.el.flavor.textContent = msg;
    }

    showBriefing() {
      const e = this.engine;
      this.el.briefingBody.innerHTML =
        `<p><strong>Your job:</strong> watch five players. Exactly one is counting cards and raising bets when the shoe gets good.</p>` +
        `<p><strong>Your tool:</strong> Hi-Lo. Small cards (2–6) add +1. Tens and aces subtract −1. 7–9 stay 0. That running total is your <em>running count</em>. Divide by decks left to get the <em>true count</em> (how rich the remaining cards are).</p>` +
        `<p><strong>How to play:</strong> keep that count in your notebook. Watch who bets bigger when the count climbs. After hand 8, tap the seat you suspect, then <strong>Remove that player</strong>. You get one Stand behind and one Force shuffle.</p>` +
        `<p>Speed starts on <strong>Slow</strong>. Hit Pause anytime. If you wait until the yellow cut card, the counter already cashed in.</p>`;
      const whale = e.getWhaleSeat();
      if (whale) {
        this.el.briefingWarn.textContent =
          `Seat ${whale.id} bought in heavy. If you back off the wrong high-action guest, the shift manager will hear about it.`;
        this.el.briefingWarn.classList.remove('hidden');
      } else {
        this.el.briefingWarn.textContent = '';
        this.el.briefingWarn.classList.add('hidden');
      }
      this.el.briefing.classList.remove('hidden');
      this.render(e.snapshot());
    }

    dismissBriefing() {
      this.el.briefing.classList.add('hidden');
      this.engine.phase = 'betting';
      this.engine.paused = false;
      const speedMs = CASE01.speedsMs[CASE01.defaultSpeedIndex] || 2400;
      this.engine.setSpeed(speedMs);
      this.el.speedBtns.forEach((x) => {
        x.classList.toggle('active', parseInt(x.getAttribute('data-speed'), 10) === speedMs);
      });
      this.engine.beginBettingWindow();
      this._schedule();
    }

    openPeek() {
      if (this.engine.peekUsed) {
        this._toast('Peek already used.');
        return;
      }
      this.el.peekModal.classList.remove('hidden');
      this.el.peekInput.value = '';
      this.el.peekInput.focus();
    }

    _scheduleResolve() {
      clearTimeout(this.timer);
      if (this.engine.called) return;
      if (this.engine.paused) return;
      this.timer = setTimeout(() => this._resolveNow(false), CASE01.betHoldMs);
    }

    _scheduleNextHand() {
      clearTimeout(this.timer);
      if (this.engine.called) return;
      if (this.engine.paused) return;
      // Novice: pause after each resolved hand so they can catch up.
      if (this.helpLevel === 0) {
        this.engine.paused = true;
        this._toast('Paused — tap Resume when you have the count, or Next hand.');
        this.render(this.engine.snapshot());
        return;
      }
      this.timer = setTimeout(() => this._startNextHand(false), this.engine.speedMs);
    }

    _startNextHand(isStep) {
      if (this.engine.called) return;
      if (this.engine.paused && !isStep) return;
      this.engine.beginBettingWindow();
      this.render(this.engine.snapshot());
      if (isStep) {
        this._resolveNow(true);
        return;
      }
      this._scheduleResolve();
    }

    _resolveNow(isStep) {
      if (this.engine.called) return;
      if (this.engine.paused && !isStep) return;
      this.engine.resolveHand();
      this.render(this.engine.snapshot());

      if (this.engine.forceCallPending && !this.engine.called) {
        this._toast('Cut card. Make the call.');
        this.engine.paused = true;
        this.render(this.engine.snapshot());
        return;
      }

      if (this.engine.called) {
        this.showDossier();
        return;
      }

      if (isStep) return;
      this._scheduleNextHand();
    }

    _stepHand() {
      clearTimeout(this.timer);
      if (this.engine.called) return;
      if (this.engine.phase === 'betting') {
        this._resolveNow(true);
      } else {
        this._startNextHand(true);
      }
    }

    _schedule() {
      this._scheduleResolve();
    }

    render(snap) {
      const decks = snap.decksRemaining;
      this.el.clock.textContent = `Hand ${snap.handIndex} · Cut in ~${decks.toFixed(1)} decks`;
      this.el.meta.textContent = `Mags · ${CASE01.pitName} · seed ${snap.seed}`;

      // seats
      this.el.seats.innerHTML = '';
      snap.seats.forEach((s) => {
        const div = document.createElement('div');
        div.className = 'seat';
        if (snap.selectedSeatId === s.id) div.classList.add('selected');
        if (snap.hoverSeatId === s.id && this.engine.seats.find((x) => x.id === s.id).flags.hoveredHandsRemaining > 0) {
          if (this.helpLevel <= 1) div.classList.add('on-you');
          else div.classList.add('hover-sil');
        }
        const pin =
          s.marks === 'warm' ? '<span class="pin warm">▲ warm</span>' :
          s.marks === 'cold' ? '<span class="pin cold">▼ cold</span>' :
          '<span class="pin">·</span>';
        const fact =
          this.helpLevel <= 1 && snap.factChips[s.id]
            ? `<div class="fact-chip">${snap.factChips[s.id]}</div>`
            : '';
        let cards = '';
        if (s.hands && s.hands.length) {
          cards = s.hands
            .map((h) => (h.cards || []).map((c) => c.rank).join(' '))
            .join(' | ');
        }
        div.innerHTML =
          `<div class="seat-id">Seat ${s.id}</div>` +
          `<div class="seat-name">${s.name}</div>` +
          `<div class="chips${s.goldTrim ? ' gold-trim' : ''}">${s.betUnits}u</div>` +
          `<div class="stack">${cash(s.stackUnits)}</div>` +
          `<div class="cards-mini">${cards}</div>` +
          pin +
          fact;
        div.addEventListener('click', () => this.engine.selectSeat(s.id));
        this.el.seats.appendChild(div);
      });

      // dealer
      const anyHands = this.engine.seats.some((s) => s.hands && s.hands[0] && s.hands[0].cards.length);
      const dCards = this.engine.seats[0] && this.engine.seats[0].dealerCards;
      this.el.dealerCards.textContent = dCards
        ? dCards.map((c) => c.rank).join(' ')
        : anyHands
          ? '…'
          : '-';
      this.el.shoeInfo.textContent = `Shoe · ${snap.cardsLeft} left`;
      this.el.discardInfo.textContent = `Discard`;

      if (snap.flavorLog && snap.flavorLog.length) {
        this.el.flavor.textContent = snap.flavorLog[snap.flavorLog.length - 1];
      }

      // notebook per help
      this._renderNotebook(snap);
      this._renderCoach(snap);

      this.el.btnHover.disabled = snap.hoverUsed || snap.called;
      this.el.btnShuffle.disabled = snap.shuffleUsed || snap.called;
      this.el.btnPeek.disabled = snap.peekUsed || snap.called;
      this.el.btnBackOff.disabled = !snap.canCall || !snap.selectedSeatId || snap.called;
      this.el.btnPass.disabled = !snap.canCall || snap.called;
      if (this.el.callHint) {
        if (snap.called) {
          this.el.callHint.textContent = '';
          this.el.callHint.classList.add('hidden');
          this.el.callHint.classList.remove('ready');
        } else if (!snap.canCall) {
          this.el.callHint.textContent = 'Watch through hand 8, then you can accuse someone';
          this.el.callHint.classList.remove('hidden', 'ready');
        } else if (!snap.selectedSeatId) {
          this.el.callHint.textContent = 'Tap a seat, then Remove that player';
          this.el.callHint.classList.remove('hidden');
          this.el.callHint.classList.add('ready');
        } else {
          this.el.callHint.textContent = 'Ready — remove the counter or pass';
          this.el.callHint.classList.remove('hidden');
          this.el.callHint.classList.add('ready');
        }
      }
      this.el.btnPass.title = 'Always wrong in Case 01 — exactly one seat is counting';
      this.el.btnPause.textContent = snap.paused ? 'Resume' : 'Pause';
      this.el.btnPause.classList.toggle('active', snap.paused);

      // tooltips help 0-1
      this.el.btnHover.title =
        this.helpLevel <= 1 ? 'Stand behind a seat for 3 hands. Counters often flatten.' : 'Hover';
      this.el.btnShuffle.title =
        this.helpLevel <= 1 ? 'Force a shuffle. Advantage players hate giving up a plus count.' : 'Shuffle Test';

      if (this.debug) {
        this.el.debug.classList.remove('hidden');
        const lines = snap.seats.map((s) => {
          const full = this.engine.seats.find((x) => x.id === s.id);
          const corr = (snap.correlations || []).find((c) => c.seatId === s.id);
          const r = corr && corr.r != null ? corr.r.toFixed(2) : 'n/a';
          const want = s.debugWanted != null ? ` want=${s.debugWanted}` : '';
          return `S${s.id} ${full.archetype} r=${r}${want}`;
        });
        this.el.debug.textContent =
          `DEBUG seed=${snap.seed} RC=${snap.runningCount} TC=${snap.trueCount} rerolls=${snap.rerollsUsed}\n` +
          `previewCounterR=${snap.counterRPreview != null ? snap.counterRPreview.toFixed(2) : '?'}\n` +
          lines.join('\n');
      } else {
        this.el.debug.classList.add('hidden');
      }
    }


    _renderCoach(snap) {
      if (!this.el.coach) return;
      if (this.helpLevel > 1) {
        this.el.coach.classList.add('hidden');
        return;
      }
      this.el.coach.classList.remove('hidden');
      const hand = snap.handIndex || 0;
      let line = '';
      if (snap.called) {
        line = '<strong>Done.</strong> Read the dossier graph: only the counter\'s bets should track the true count.';
      } else if (hand < 1) {
        line = '<strong>Before the first hand:</strong> chips go down. Watch who buys in big (gold rim) — whales look loud but often are not counting.';
      } else if (hand < 8) {
        line =
          `<strong>Hand ${hand} of 8+.</strong> Update your running count as cards come out. ` +
          (snap.canCall
            ? ''
            : 'You can Mark / Stand behind / Force shuffle now. Calling unlocks after hand 8.');
      } else {
        line =
          `<strong>You can call.</strong> Tap the seat that raised with the count, then Remove that player. ` +
          'Pass means you think nobody is counting — wrong in this case.';
      }
      if (snap.trueCount >= 2 && this.helpLevel === 0 && !snap.called) {
        line += ' <strong>Count is hot (+' + snap.trueCount + ').</strong> Who just pushed more chips?';
      }
      this.el.coach.innerHTML = line;
    }

    _renderNotebook(snap) {
      const h = this.helpLevel;
      let html = '';
      if (h <= 1) {
        html += `<span>Running count <strong>${snap.runningCount}</strong></span>`;
        html += `<span>Decks left <strong>${snap.decksRemaining.toFixed(2)}</strong></span>`;
        html += `<span>True count <strong>${snap.trueCount}</strong></span>`;
      } else if (h === 2) {
        html += `<span>Running count <strong>${snap.runningCount}</strong></span>`;
        html += `<span>Decks left <strong>${snap.decksRemaining.toFixed(2)}</strong></span>`;
        html += `<span>True count <em>(you figure)</em></span>`;
      } else if (h === 3) {
        html += `<span>Decks left <strong>${snap.decksRemaining.toFixed(2)}</strong></span>`;
      } else {
        html += `<span class="muted">Notebook blank — count in your head</span>`;
      }
      const tip =
        h === 0
          ? 'Tip: when true count is high (+2 or more), look for someone suddenly betting more units.'
          : h === 1
            ? 'Tip: bet size should climb with the true count if they are counting.'
            : '';
      const note = snap.notebookNote || tip;
      this.el.notebook.innerHTML = html + `<div class="note" id="notebookNote">${note}</div>`;
    }

    showDossier() {
      clearTimeout(this.timer);
      const d = Case01Dossier.buildDossier(this.engine);
      this._lastDossier = d;
      this.el.dossier.classList.remove('hidden');
      this.el.dossierBody.innerHTML =
        `<div class="rank">${d.rank} · ${d.score}</div>` +
        `<div class="manager">${d.managerLine}</div>` +
        `<div class="row">${d.callRow}</div>` +
        `<div class="row">${d.truthRow}</div>` +
        `<div class="row">Leak: $${d.leakCash} in extra units before the call</div>` +
        `<div class="row">${d.toolsRow}</div>` +
        `<div class="row">${d.civilianBurn}</div>` +
        `<div class="teachable">${d.teachable}</div>` +
        `<div class="row" style="margin-top:0.75rem"><a href="#" id="linkDrill" style="color:var(--gold)">Sharpen count  -  Running Count Speed Drill</a></div>`;
      const link = qs('#linkDrill', this.el.dossierBody);
      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this._toast('Training drill lives in the main CountQuest app.');
        });
      }
      requestAnimationFrame(() => {
        Case01Dossier.drawBetVsTcGraph(this.el.graphCanvas, d, { showMarks: this.showMarksOnGraph });
      });
      this.render(this.engine.snapshot());
    }
  }

  function boot() {
    const q = new URLSearchParams(location.search);
    if (q.get('test') === '1') {
      // tests module will run
      return;
    }
    global.case01UI = new Case01UI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.Case01UI = Case01UI;
})(typeof window !== 'undefined' ? window : globalThis);
