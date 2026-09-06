// §25 Dice Roll - replaces Scratch/Reveal lobby minigame (keeps id scratch-win)
(function () {
  function dicePayout(d1, d2) {
    var total = d1 + d2;
    var isDouble = d1 === d2;
    if (total === 2 || total === 12) return { chips: 200, label: 'Jackpot!' };
    if (isDouble && (total === 8 || total === 10)) return { chips: 150, label: 'Hot doubles!' };
    if (isDouble) return { chips: 100, label: 'Doubles!' };
    if (total === 7) return { chips: 75, label: 'Lucky 7!' };
    if (total === 11) return { chips: 60, label: 'Yo eleven!' };
    if (total === 6 || total === 8) return { chips: 40, label: 'Solid roll' };
    if (total === 5 || total === 9) return { chips: 25, label: 'Small win' };
    return { chips: 0, label: 'No payout' };
  }
  function faceHtml(n) {
    return '<div class="cq-die" data-face="' + n + '" aria-label="Die showing ' + n + '"><span class="cq-die-pips"></span></div>';
  }
  function applyDice() {
    if (typeof LOBBY_MINIGAMES !== 'undefined') {
      var mg = LOBBY_MINIGAMES.find(function (m) { return m.id === 'scratch-win'; });
      if (mg) { mg.label = 'Dice Roll'; mg.icon = '\uD83C\uDFB2'; }
    }
    if (typeof CountQuestApp === 'undefined') return false;
    var proto = CountQuestApp.prototype;
    if (proto.__cqDiceMinigamePatched) return true;
    proto.__cqDiceMinigamePatched = true;
    var origOpen = proto.openLobbyMinigame;
    proto.openLobbyMinigame = function (id) {
      origOpen.call(this, id);
      if (id !== 'scratch-win') return;
      var def = LOBBY_MINIGAMES.find(function (m) { return m.id === id; });
      if (!def) return;
      var ready = canPlayLobbyMinigame(this.save, def.key);
      var btn = document.getElementById('btn-lobby-minigame-action');
      if (btn) {
        if (ready) { btn.textContent = 'Roll'; btn.disabled = false; btn.hidden = false; btn.style.display = ''; }
        else { btn.hidden = true; btn.style.display = 'none'; btn.disabled = true; }
      }
      var title = document.getElementById('lobby-minigame-title');
      if (title) title.textContent = 'Dice Roll';
      var icon = document.getElementById('lobby-minigame-icon');
      if (icon) icon.textContent = '\uD83C\uDFB2';
      var desc = document.getElementById('lobby-minigame-desc');
      if (desc && ready) desc.textContent = 'Roll the dice once per day - 7s, doubles, and jackpots pay out!';
    };
    var origBody = proto.renderMinigameBody;
    proto.renderMinigameBody = function (id, ready) {
      if (id === 'scratch-win' && ready) {
        this._diceRolled = false; this._diceTotal = 0; this._diceReward = 0;
        return '<p class="text-sm">Tap <strong>Roll</strong> for two dice. Lucky 7, doubles, and 2/12 jackpot pay chips.</p>' +
          '<div class="cq-dice-tray" id="cq-dice-tray" aria-live="polite">' + faceHtml(1) + faceHtml(1) + '</div>' +
          '<p id="cq-dice-result" class="text-xs text-amber-300/90 mt-2 min-h-[1.25rem]">Ready to roll</p>' +
          '<p class="text-[10px] text-emerald-400/60 mt-1">Payout: 7->75 · doubles->100+ · 2/12->200 · else small/zero</p>';
      }
      return origBody.call(this, id, ready);
    };
    var origPlay = proto.playLobbyMinigame;
    proto.playLobbyMinigame = async function () {
      var id = this._lobbyMinigameId;
      if (id !== 'scratch-win') return origPlay.call(this);
      var def = LOBBY_MINIGAMES.find(function (m) { return m.id === id; });
      if (!def || !canPlayLobbyMinigame(this.save, def.key)) {
        document.getElementById('modal-lobby-minigame')?.close();
        return;
      }
      var btn = document.getElementById('btn-lobby-minigame-action');
      if (btn) btn.disabled = true;
      var tray = document.getElementById('cq-dice-tray');
      var resEl = document.getElementById('cq-dice-result');
      if (tray) tray.classList.add('cq-dice-rolling');
      if (resEl) resEl.textContent = 'Rolling...';
      for (var i = 0; i < 10; i++) {
        if (tray) tray.innerHTML = faceHtml(1 + Math.floor(Math.random() * 6)) + faceHtml(1 + Math.floor(Math.random() * 6));
        await new Promise(function (r) { setTimeout(r, 55 + i * 8); });
      }
      var d1 = 1 + Math.floor(Math.random() * 6);
      var d2 = 1 + Math.floor(Math.random() * 6);
      var payout = dicePayout(d1, d2);
      if (tray) { tray.classList.remove('cq-dice-rolling'); tray.innerHTML = faceHtml(d1) + faceHtml(d2); }
      var total = d1 + d2;
      this._diceRolled = true; this._diceTotal = total; this._diceReward = payout.chips;
      if (resEl) resEl.textContent = 'Rolled ' + d1 + ' + ' + d2 + ' = ' + total + ' - ' + payout.label + (payout.chips ? ' (+' + payout.chips + ' chips)' : '');
      if (payout.chips) addChips(this.save, payout.chips);
      markLobbyMinigamePlayed(this.save, def.key);
      this.persist();
      if (typeof Sounds !== 'undefined' && Sounds.play) Sounds.play('chip');
      this.toast(payout.chips ? 'Dice Roll: ' + payout.label + ' +' + payout.chips + ' chips!' : 'Dice Roll: ' + payout.label + ' - try tomorrow!', payout.chips ? 'win' : 'info', 4000);
      await new Promise(function (r) { setTimeout(r, 900); });
      document.getElementById('modal-lobby-minigame')?.close();
      this.renderLobby();
      if (btn) btn.disabled = false;
    };
    return true;
  }
  function boot() {
    if (applyDice()) return;
    var n = 0;
    var t = setInterval(function () { if (applyDice() || ++n > 50) clearInterval(t); }, 50);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
