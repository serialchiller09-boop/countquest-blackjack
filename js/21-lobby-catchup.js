// §21 Lobby catch-up — dual Close hide + Scratch→Reveal (loads after CountQuestApp)
(function () {
  function applyLobbyCatchup() {
    if (typeof LOBBY_MINIGAMES !== 'undefined') {
      const mg = LOBBY_MINIGAMES.find((m) => m.id === 'scratch-win');
      if (mg) mg.label = 'Reveal & Win';
    }
    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqLobbyCatchupApplied) return true;
    proto.__cqLobbyCatchupApplied = true;

    const origOpen = proto.openLobbyMinigame;
    proto.openLobbyMinigame = function (id) {
      origOpen.call(this, id);
      const def = LOBBY_MINIGAMES.find((m) => m.id === id);
      if (!def) return;
      const ready = canPlayLobbyMinigame(this.save, def.key);
      const btn = document.getElementById('btn-lobby-minigame-action');
      if (btn) {
        if (ready) {
          btn.textContent = id === 'scratch-win' ? 'Claim Prize' : 'Play Now';
          btn.disabled = false;
          btn.hidden = false;
          btn.style.display = '';
        } else {
          // Avoid dual Close: #btn-lobby-minigame-close already closes the modal
          btn.hidden = true;
          btn.style.display = 'none';
          btn.disabled = true;
          btn.textContent = 'Play Now';
        }
      }
      if (id === 'scratch-win' && ready) {
        const body = document.getElementById('lobby-minigame-body');
        const hint = body && body.querySelector('p.text-sm');
        if (hint && /Scratch/i.test(hint.textContent || '')) {
          hint.textContent = 'Tap to reveal — uncover all 3 tiles for your prize!';
        }
        body?.querySelectorAll('.lobby-scratch-tile').forEach((tile, i) => {
          if (!tile.classList.contains('revealed')) {
            tile.textContent = 'Tap';
            tile.setAttribute('aria-label', 'Reveal tile ' + (i + 1));
          }
        });
      }
    };

    const origPlay = proto.playLobbyMinigame;
    proto.playLobbyMinigame = async function () {
      const id = this._lobbyMinigameId;
      if (id === 'scratch-win') {
        const origToast = this.toast;
        this.toast = function (msg, ...rest) {
          if (typeof msg === 'string') {
            msg = msg
              .replace(/^Scratch all 3 tiles first$/, 'Reveal all 3 tiles first')
              .replace(/^Scratch: /, 'Reveal: ');
          }
          return origToast.call(this, msg, ...rest);
        };
        try {
          return await origPlay.call(this);
        } finally {
          this.toast = origToast;
        }
      }
      return origPlay.call(this);
    };

    const origBody = proto.renderMinigameBody;
    proto.renderMinigameBody = function (id, ready) {
      if (id === 'scratch-win' && ready) {
        const prizes = [25, 50, 100, 0, 25, 50, 75, 100, 150];
        this._scratchPrizes = prizes.sort(() => Math.random() - 0.5).slice(0, 3);
        this._scratchRevealed = 0;
        return `<p class="text-sm">Tap to reveal — uncover all 3 tiles for your prize!</p>
        <div class="lobby-scratch-grid" id="scratch-grid">
          ${[0, 1, 2].map((i) => `<button type="button" class="lobby-scratch-tile" data-scratch-idx="${i}" aria-label="Reveal tile ${i + 1}">Tap</button>`).join('')}
        </div>
        <p id="scratch-result" class="text-xs text-amber-300/90 mt-2 min-h-[1rem]"></p>`;
      }
      return origBody.call(this, id, ready);
    };

    return true;
  }

  function boot() {
    if (applyLobbyCatchup()) return;
    let n = 0;
    const t = setInterval(() => {
      if (applyLobbyCatchup() || ++n > 50) clearInterval(t);
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
