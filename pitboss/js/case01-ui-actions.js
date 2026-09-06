/**
 * Case 01 UI actions — seat sheet, Next hand, coach, dossier.
 */
(function (global) {
  'use strict';
  var P = global.Case01UI && global.Case01UI.prototype;
  if (!P) return;
  function qs(sel, root) { return (root || document).querySelector(sel); }


  P._openSeatSheet = function (seatId) {
      this.engine.selectSeat(seatId);
      const seat = this.engine.seats.find((s) => s.id === seatId);
      if (!seat || !this.el.seatSheet) return;
      const snap = this.engine.snapshot();
      this.el.sheetTitle.textContent = 'Seat ' + seat.id + ' · ' + seat.name;
      this.el.sheetSub.textContent =
        'Betting ' + seat.betUnits + ' units · stack $' + seat.stackUnits * CASE01.unitCash;
      this.el.sheetHover.disabled = snap.hoverUsed || snap.called;
      this.el.sheetAccuse.disabled = !snap.canCall || snap.called;
      this.el.sheetAccuse.textContent = snap.canCall
        ? 'Remove this player'
        : 'Remove this player (after hand 8)';
      this.el.sheetTip.textContent = snap.canCall
        ? 'Only remove them if their bets climbed when the count got hot.'
        : 'You can mark or stand behind now. Accusing unlocks after hand 8.';
      this.el.seatSheet.classList.remove('hidden');
      this.render(this.engine.snapshot());
    }

  P._closeSeatSheet = function () {
      if (this.el.seatSheet) this.el.seatSheet.classList.add('hidden');
    }

  P._onPrimary = function () {
      if (this.engine.called) return;
      const snap = this.engine.snapshot();
      if (snap.canCall) {
        this._toast('Tap the seat you want to remove.');
        return;
      }
      // Always advance one hand from the big button (novice-friendly).
      clearTimeout(this.timer);
      this.engine.paused = false;
      if (this.engine.phase === 'betting') {
        this._resolveNow(true);
        if (this.helpLevel === 0 && !this.engine.called) {
          this.engine.paused = true;
          this.render(this.engine.snapshot());
        } else if (!this.engine.called) {
          this._scheduleNextHand();
        }
        return;
      }
      this._startNextHand(true);
      if (this.helpLevel === 0 && !this.engine.called) {
        this.engine.paused = true;
        this.render(this.engine.snapshot());
      }
    }

  P._renderPrimary = function (snap) {
      if (!this.el.btnPrimary) return;
      const btn = this.el.btnPrimary;
      const pass = this.el.btnPassLite;
      if (snap.called) {
        btn.disabled = true;
        btn.textContent = 'Case closed';
        if (pass) pass.disabled = true;
        return;
      }
      if (snap.canCall) {
        btn.textContent = 'Tap a seat to accuse';
        btn.disabled = false;
        btn.classList.add('danger');
        btn.classList.remove('primary');
        if (pass) pass.disabled = false;
      } else if (snap.paused) {
        btn.textContent = 'Next hand';
        btn.disabled = false;
        btn.classList.add('primary');
        btn.classList.remove('danger');
        if (pass) pass.disabled = true;
      } else {
        btn.textContent = 'Pause';
        btn.disabled = false;
        btn.classList.add('primary');
        btn.classList.remove('danger');
        if (pass) pass.disabled = true;
      }
    }

  P._renderCoach = function (snap) {
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
        line = '<strong>Start:</strong> tap Next hand. Then tap any player for Mark / Stand behind / Remove.';
      } else if (hand < 8) {
        line =
          `<strong>Hand ${hand}.</strong> Update your running count. Tap a player to act on them. Accuse unlocks after hand 8.`;
      } else {
        line =
          '<strong>You can accuse.</strong> Tap the player whose bets rose with the count, then Remove. Pass is wrong in this case.';
      }
      if (snap.trueCount >= 2 && this.helpLevel === 0 && !snap.called) {
        line += ' <strong>Count is hot (+' + snap.trueCount + ').</strong> Who just pushed more chips?';
      }
      this.el.coach.innerHTML = line;
    }

  P._renderNotebook = function (snap) {
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

  P.showDossier = function () {
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
    };


  function boot() {
    var q = new URLSearchParams(location.search);
    if (q.get('test') === '1') return;
    global.case01UI = new global.Case01UI();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
