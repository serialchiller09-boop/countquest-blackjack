// §7 GAME ENGINE
// ═══════════════════════════════════════════════════════════════
class CountQuestApp {
  constructor() {
    this.save = migrateSave(Storage.load()) || defaultSave();
    this.phase = 'menu';
    this.dealerSession = null;
    this._dealerTimerId = null;
    this.shoe = null;
    this.counter = this.createCounter();
    this.help = new HelpSystem(this.save.stats.helpLevel);
    this.dealer = new Hand();
    this.playerHands = [];
    this.activeIdx = 0;
    this.splitDone = false;
    this.hideHole = true;
    this.roundReview = null;
    this.handNetPL = 0;
    this.insuranceBet = 0;
    this.session = null;
    this.pendingShoeReport = null;
    this.countConfirmed = false;
    this.betSuggestion = null;
    this.dealAnimIndex = 0;
    this.revealHoleAnim = false;
    this.lastHiLoTagDealt = 0;
    this.dealing = false;
    this.tableAiSeats = null;
    this.drillState = null;
    this.dailyChallenge = null;
    this.dailyTracker = null;
    this.dailyTrainingGoal = null;
    this.drillSessionStartedAt = null;
    this.pendingDrillSummary = null;
    this.drillSummaryComparison = null;
    this.drillSummaryReturnPhase = 'training';
    this.drillSummaryDrillId = null;
    this.drillSummaryExtras = null;
    this.tutorialNavBusyUntil = 0;
    this.trainingHistoryFilter = 'all';
    this.clubsView = 'main';
    this.clubSearchQuery = '';
    this._lastPhase = null;
    this.ui = { bind: this.bindUI.bind(this), render: this.render.bind(this) };
    if (this.save.settings.soundEnabled === undefined) this.save.settings.soundEnabled = true;
    if (!this.save.settings.rules) this.save.settings.rules = defaultRules();
    if (!this.save.personalBests) this.save.personalBests = defaultPersonalBests();
    if (!this.save.achievements) this.save.achievements = [];
    if (!this.save.countingUnlocks) this.save.countingUnlocks = ['hi-lo'];
    if (!this.save.uiHints) this.save.uiHints = { shoeTermExplained: false, hardHandTips: 0 };
    if (this.save.settings.showCountDisplay === undefined) this.save.settings.showCountDisplay = true;
    if (this.save.settings.showCountPopups === undefined) this.save.settings.showCountPopups = true;
    if (this.save.settings.useIndexDeviations === undefined) this.save.settings.useIndexDeviations = true;
    this._afterCountQuiz = null;
    Sounds.setEnabled(this.save.settings.soundEnabled);
    if (window.__CQ_TEST_MODE) return;
    this.applyTheme(this.save.settings.theme || 'classic');
    this.refreshDailyTrainingGoal();
    ensureDailyRewardsCurrent(this.save);
    this.bindUI();
    this._onCasinoShellResize = () => {
      if (['bet', 'playing', 'countConfirm', 'handEnd'].includes(this.phase)) this.syncCasinoShellMetrics();
    };
    window.addEventListener('resize', this._onCasinoShellResize);
    this.initBranding();
    this.injectCountGuide();
    if (checkCountingUnlocks(this.save).length) this.persist();
    const urlParams = new URLSearchParams(location.search);
    const returnHandled = ExternalIAP.handleReturnParams(this.save, urlParams);
    if (returnHandled?.ok) {
      this.persist();
      if (returnHandled.type === 'vip') {
        this.toast(`VIP Pass activated! Expires ${returnHandled.expiresAt}`, 'level', 5000);
      } else if (returnHandled.bonus) {
        this.toast(`Account linked! +${returnHandled.bonus.chips} chips · +${returnHandled.bonus.gems} 💎`, 'level', 4500);
      }
    } else {
      handleDeepLinks(this, urlParams);
    }
    this.updateSoundButton();
    this.render();
    this._dailyRewardModalShown = false;
    setTimeout(() => this.maybeShowDailyRewardModal(), 400);
  }

  activeCountingSystem() {
    const id = this.settings.countingSystem || 'hi-lo';
    return COUNTING_SYSTEMS[id] ? id : 'hi-lo';
  }

  createCounter(systemId = null) {
    return new CardCounter(systemId || this.activeCountingSystem());
  }

  injectCountGuide() {
    const html = buildCountGuideHtml(this.activeCountingSystem());
    document.getElementById('how-to-count-menu').innerHTML = html;
    document.getElementById('how-to-count-bet').innerHTML = html;
  }

  setCountingSystem(systemId) {
    const unlocks = this.save.countingUnlocks || ['hi-lo'];
    if (!COUNTING_SYSTEMS[systemId]) {
      this.toast('Unknown counting system', 'error');
      return;
    }
    if (!unlocks.includes(systemId)) {
      this.toast(COUNTING_SYSTEMS[systemId].unlockHint, 'info', 4000);
      return;
    }
    if (this.settings.countingSystem === systemId) return;
    const wasInGame = ['bet', 'countConfirm', 'playing', 'handEnd', 'drill-count'].includes(this.phase);
    this.save.settings.countingSystem = systemId;
    this.counter = this.createCounter(systemId);
    this.injectCountGuide();
    this.updateSettingsAdvisory();
    if (this.shoe) {
      if (wasInGame) this.help.newShoe();
      this.shoe.reset();
      this.initializeCounterFromBurnedCards();
    }
    this.persist();
    const name = COUNTING_SYSTEMS[systemId].name;
    this.toast(wasInGame ? `Switched to ${name} — shoe reset for new tags` : `Counting system: ${name}`, 'info', 3200);
    updateTutorialCountExplanation();
    if (wasInGame && this.session) {
      if (this.save.sessionDrill === 'count-shoe') this.startCountShoeDrill();
      else this.beginBetPhase();
    } else {
      this.render();
    }
    this.checkEngagement();
  }

  /** Tutorial “How to Count” copy — reflects active counting system (Hi-Lo vs KO). */
  updateTutorialCountExplanation() {
    const system = this.activeCountingSystem();
    const el = document.getElementById('count-explain-text');
    if (!el) return;
    const pivot = getKoPivot(this.settings.numDecks || 6);
    if (system === 'ko') {
      el.innerHTML = `Cards come from the <strong>shoe</strong> (the table’s card dispenser). With <strong>KO</strong> counting, add +1 for low cards (2–7), 0 for 8–9, and −1 for high cards (10–Ace). Bet a little more when your running count rises above the <strong>key count</strong> — no division needed.`;
    } else {
      el.innerHTML = 'Cards come from the <strong>shoe</strong> (the table’s card dispenser). Add +1 for low cards (2–6), 0 for 7–9, and −1 for high cards (10–Ace) to get your <strong>running count</strong>. '
        + 'Divide by decks left to get the <strong>true count</strong>. Bet a little more when true count is +1 or higher.';
    }
    const demo = document.getElementById('tutorial-demo');
    if (demo && !demo.classList.contains('hidden')) {
      demo.textContent = system === 'ko'
        ? `7♠ → +1  |  10♥ → −1  |  8♦ → 0  |  running count +5 vs key +${pivot} → bet ramp`
        : '5♠ → +1  |  10♥ → −1  |  8♦ → 0  |  running count +6 ÷ 3 decks = true count +2.0';
    }
  }

  updateSettingsAdvisory() {
    const el = document.getElementById('rules-warning');
    if (!el) return;
    const text = buildSettingsAdvisoryText(this.rules, this.activeCountingSystem(), this.settings.numDecks || 6);
    if (text) {
      el.innerHTML = text.replace(/\. /g, '.<br>');
      el.classList.remove('hidden');
    } else {
      el.innerHTML = '';
      el.classList.add('hidden');
    }
  }

  updateSoundButton() {
    const btn = document.getElementById('btn-sound');
    if (btn) btn.textContent = Sounds.enabled ? '🔊' : '🔇';
  }

  get practice() { return this.save.settings.practiceMode; }
  get chips() { syncWalletSave(this.save); return this.save.chips; }
  set chips(v) { this.save.chips = v; this.save.bankroll = v; }
  get gems() { syncWalletSave(this.save); return this.save.gems; }
  set gems(v) { this.save.gems = v; }
  get bankroll() { return this.chips; }
  set bankroll(v) { this.chips = v; }
  get stats() { return this.save.stats; }
  get settings() { return this.save.settings; }
  get minBet() { return this.settings.minBet; }
  get rules() { return this.settings.rules || defaultRules(); }
  get sessionMode() { return this.save.sessionMode; }
  get uiHints() { return this.save.uiHints || (this.save.uiHints = { shoeTermExplained: false, hardHandTips: 0 }); }

  wantsCountDisplay() {
    return this.settings.showCountDisplay !== false;
  }

  wantsCountPopups() {
    return this.settings.showCountPopups !== false && this.wantsCountDisplay();
  }

  usesIndexDeviations() {
    return this.settings.useIndexDeviations !== false && this.activeCountingSystem() === 'hi-lo';
  }

  buildStratOpts(snap = null) {
    const countSnap = snap || (this.shoe ? this.counter.getCountSnapshot(this.shoe) : null);
    return {
      trueCount: countSnap?.trueCount ?? null,
      countingSystemId: this.activeCountingSystem(),
      useIndexDeviations: this.usesIndexDeviations(),
    };
  }

  recordLiveStrategyMistake(action, advice, context) {
    if (!this.save || this.save.sessionDrill) return;
    const indexPlay = isIndexDeviationRationale(advice.rationale);
    recordMistakeReviewEntry(this.save, {
      drillId: 'live',
      category: indexPlay ? 'deviation' : 'strategy',
      context,
      wrong: formatIndexPlayAction(action),
      correct: formatIndexPlayAction(advice.action),
      meta: { indexPlay, rationale: advice.rationale },
    });
  }

  resetCountQuizModal() {
    document.getElementById('count-quiz-form')?.classList.remove('hidden');
    document.getElementById('count-quiz-feedback')?.classList.add('hidden');
    document.getElementById('count-quiz-result').textContent = '';
    document.getElementById('count-quiz-explanation').textContent = '';
    document.getElementById('btn-count-quiz-skip')?.classList.remove('hidden');
    const input = document.getElementById('count-quiz-input');
    if (input) input.value = '';
  }

  showCountQuizFeedback(ok, playerGuess, actualRunningCount, extra = '') {
    document.getElementById('count-quiz-form').classList.add('hidden');
    document.getElementById('count-quiz-feedback').classList.remove('hidden');
    document.getElementById('btn-count-quiz-skip').classList.add('hidden');
    const resultEl = document.getElementById('count-quiz-result');
    const explainEl = document.getElementById('count-quiz-explanation');
    const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
    const offBy = Math.abs(playerGuess - actualRunningCount);
    resultEl.textContent = ok
      ? `✓ Correct! The running count is ${fmt(actualRunningCount)}.`
      : `✗ Not quite — you guessed ${fmt(playerGuess)}. The running count is ${fmt(actualRunningCount)} (off by ${offBy}).`;
    explainEl.innerHTML =
      `<strong>What is the running count?</strong> It is the running total of card tags you have seen this dealing round. `
      + `Low cards add +1, high cards subtract −1, and 7–9 are neutral. `
      + `Trainers often accept guesses within ±1 of the true count.${extra ? `<br><br>${extra}` : ''}`;
    document.getElementById('btn-count-quiz-continue')?.focus();
  }

  dismissCountQuiz() {
    const modal = document.getElementById('modal-count-quiz');
    modal.close();
    modal.classList.remove('casino-count-quiz-dialog');
    this.resetCountQuizModal();
    const after = this._afterCountQuiz;
    this._afterCountQuiz = null;
    if (typeof after === 'function') after();
  }

  maybeExplainShoeTerm() {
    if (this.uiHints.shoeTermExplained) return '';
    this.uiHints.shoeTermExplained = true;
    this.persist();
    return '<span class="shoe-term-hint">Shoe = the card dispenser on the table that holds several decks mixed together.</span>';
  }

  handTotalHtml(hand, hideHole = false) {
    const main = hand.beginnerDisplaySummary(hideHole);
    const { aces } = hand.rawValue();
    const showHardTip = !hideHole && !hand.isSoft() && !hand.isBlackjack() && !hand.isBust()
      && this.uiHints.hardHandTips < 3;
    if (showHardTip && hand.value() >= 12) {
      this.uiHints.hardHandTips++;
      this.persist();
      const tip = aces > 0
        ? 'A “hard” hand means your Ace is counting as 1, not 11 — so hitting cannot bust you with a soft total.'
        : 'A “hard” hand has no Ace counted as 11 — the total is fixed unless you draw more cards.';
      return `${main}<span class="hand-type-hint">${tip}</span>`;
    }
    return main;
  }

  persist() {
    this.save.lastSavedAt = new Date().toISOString();
    const result = Storage.save(this.save);
    const el = document.getElementById('save-status');
    if (!result.ok) {
      if (el) el.textContent = 'Save failed';
      this.toast(result.error || 'Could not save progress', 'error', 4500);
      return false;
    }
    if (el) el.textContent = 'Saved ' + new Date().toLocaleTimeString();
    return true;
  }

  showFieldError(resultElementId, message) {
    const el = document.getElementById(resultElementId);
    if (el) el.textContent = message ? `✗ ${message}` : '';
  }

  /** Max plausible running-count guess for the active shoe (used in input hints). */
  runningCountGuessLimit() {
    const decks = this.shoe?.numDecks || this.settings.numDecks || 6;
    return decks * 22 + 15;
  }

  ensureActiveSession() {
    if (this.session) return true;
    this.toast('No active session — return to the main menu', 'error');
    return false;
  }

  spawnLevelUpParticles() {
    const modal = document.getElementById('modal-help-levelup');
    const existing = modal.querySelector('.level-up-particles');
    if (existing) existing.remove();
    const container = document.createElement('div');
    container.className = 'level-up-particles';
    const colors = ['#fbbf24', '#34d399', '#a78bfa', '#f472b6', '#60a5fa', '#fde68a'];
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'level-up-particle';
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 60 + Math.random() * 90;
      p.style.setProperty('--px', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--py', `${Math.sin(angle) * dist}px`);
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = `${Math.random() * 0.15}s`;
      container.appendChild(p);
    }
    modal.appendChild(container);
    setTimeout(() => container.remove(), 1400);
  }

  /**
   * Celebrates an automatic help-level promotion with animation, copy, and sound.
   * Defers follow-up modals (count quiz, shoe report) until the player dismisses.
   */
  showHelpLevelUpCelebration(previousLevel, newLevel, onDismiss) {
    const fromLabel = HELP_LABELS[previousLevel] || `Level ${previousLevel}`;
    const toLabel = HELP_LABELS[newLevel] || `Level ${newLevel}`;
    document.getElementById('levelup-from-label').textContent = fromLabel;
    document.getElementById('levelup-from-num').textContent = `Level ${previousLevel}`;
    document.getElementById('levelup-to-label').textContent = toLabel;
    document.getElementById('levelup-to-num').textContent = `Level ${newLevel}`;
    document.getElementById('levelup-title').textContent = `${toLabel} Mode Unlocked`;
    document.getElementById('levelup-subtitle').textContent =
      `Your accuracy earned a tougher training tier. ${HELP_DESC[newLevel]}`;
    const whatsNew = HELP_LEVEL_WHATS_NEW[newLevel] || HELP_DESC[newLevel];
    document.getElementById('levelup-whats-new').innerHTML =
      `<div class="text-[10px] uppercase tracking-wider text-amber-400/80 mb-1">What changes now</div>${whatsNew}`;
    document.getElementById('levelup-encouragement').textContent =
      HELP_LEVEL_ENCOURAGEMENT[newLevel] || 'Keep pushing — you\'re improving.';

    Sounds.play('level');
    setTimeout(() => Sounds.play('level'), 180);

    this.spawnLevelUpParticles();
    const modal = document.getElementById('modal-help-levelup');
    modal.showModal();

    const headerBtn = document.getElementById('btn-help-settings');
    if (headerBtn) {
      headerBtn.classList.remove('header-help-pulse');
      void headerBtn.offsetWidth;
      headerBtn.classList.add('header-help-pulse');
    }

    const close = () => {
      modal.close();
      this.toast(`Help Level ${newLevel} — ${toLabel}`, 'level', 2800);
      if (typeof onDismiss === 'function') onDismiss();
    };
    document.getElementById('btn-help-levelup-close').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
  }

  openCountQuizModal(focusInput = true) {
    this.resetCountQuizModal();
    this._afterCountQuiz = null;
    const isCombined = this.help.modeProfile === 'drill-combined';
    const modal = document.getElementById('modal-count-quiz');
    modal.classList.add('casino-count-quiz-dialog');
    document.querySelector('#modal-count-quiz h3').textContent = isCombined
      ? 'Combined Practice — Count Check'
      : 'Running Count Quiz';
    document.querySelector('#modal-count-quiz > p').textContent = isCombined
      ? 'What is the running count after that hand? You\'ll get strategy feedback too. ±1 counts as correct.'
      : 'What is the running count right now? A guess within ±1 of the actual count counts as correct.';
    modal.showModal();
    const quizInput = document.getElementById('count-quiz-input');
    const rcLimit = this.runningCountGuessLimit();
    quizInput.min = -rcLimit;
    quizInput.max = rcLimit;
    quizInput.placeholder = `Your guess (±${rcLimit})`;
    if (focusInput) quizInput.focus();
  }

  /** Show count quiz / shoe report after hand end (may be deferred behind level-up). */
  showPostHandModals() {
    const wantsQuiz = this.help.postHandQuiz();
    const optionalQuiz = this.help.postHandQuizOptional();
    if (wantsQuiz) {
      setTimeout(() => this.openCountQuizModal(), 280);
    } else if (optionalQuiz) {
      this._handendQuizOptional = true;
      this.renderHandEnd();
    }
    if (this.pendingShoeReport) {
      this.showShoeAnalysis(this.pendingShoeReport);
      this.pendingShoeReport = null;
    }
  }

  grantAchievements(newly) {
    if (!newly?.length) return;
    const show = (i) => {
      if (i >= newly.length) return;
      const a = newly[i];
      document.getElementById('achievement-pop-icon').textContent = a.icon;
      document.getElementById('achievement-pop-title').textContent = a.name;
      document.getElementById('achievement-pop-desc').textContent = a.desc;
      Sounds.play('level');
      document.getElementById('modal-achievement').showModal();
      document.getElementById('btn-achievement-close').onclick = () => {
        document.getElementById('modal-achievement').close();
        if (i + 1 < newly.length) setTimeout(() => show(i + 1), 400);
      };
    };
    show(0);
  }

  checkEngagement(extra = {}) {
    updatePersonalBests(this.save, extra);
    if (extra.type === 'handEnd') {
      this.trackClubWeekly('hand', { won: (extra.handNetPL || 0) > 0 });
    }
    const newSystems = checkCountingUnlocks(this.save);
    if (newSystems.includes('ko')) {
      this.toast('KO counting system unlocked — switch in Settings!', 'level', 4500);
    }
    const newly = checkAchievements(this.save);
    if (newSystems.length || newly.length) {
      this.persist();
      if (newly.length) this.grantAchievements(newly);
    }
    return newly;
  }

  exportStats() {
    try {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'CountQuest Blackjack',
      version: SAVE_VERSION,
      save: this.save,
      computed: {
        countAccuracy: calculateCountAccuracyPercent(this.stats),
        decisionAccuracy: calculateStrategyAccuracyPercent(this.stats),
        recentCountAccuracy: calculateRecentCountAccuracyPercent(this.stats),
        rank: ['Novice','Apprentice','Journeyman','Expert','Master'][this.stats.rank],
        helpLevel: this.stats.helpLevel,
        achievementsUnlocked: normalizeAchievements(this.save.achievements).length,
        achievementsTotal: ACHIEVEMENTS.length,
        personalBests: this.save.personalBests,
        nextMilestone: nextMilestone(this.save),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `countquest-stats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    this.toast('Stats exported — open in Excel or any JSON viewer', 'success', 3500);
    } catch (err) {
      console.error('CountQuest: export failed —', err);
      this.toast('Export failed — try again', 'error');
    }
  }

  openResetDialog() {
    document.getElementById('modal-reset').showModal();
  }

  confirmResetProgress() {
    document.getElementById('modal-reset').close();
    Storage.reset();
    localStorage.removeItem('cq-sound');
    this.save = defaultSave();
    this.help = new HelpSystem(0);
    this.phase = 'menu';
    this.session = null;
    this.applyTheme('classic');
    this.counter = this.createCounter();
    this.injectCountGuide();
    Sounds.setEnabled(true);
    this.updateSoundButton();
    this.toast('Progress reset — fresh start!', 'info', 3000);
    this.render();
  }

  initBranding() {
    const menuSlot = document.getElementById('menu-logo-slot');
    if (menuSlot && !menuSlot.innerHTML) menuSlot.innerHTML = countQuestLogoMarkup(56);
    this.updateThemeBrandingLabel();
  }

  updateThemeBrandingLabel() {
    const t = THEMES[this.save.settings.theme || 'classic'] || THEMES.classic;
    const pill = document.getElementById('menu-theme-label');
    if (pill) pill.textContent = t.name;
  }

  applyTheme(themeId) {
    document.body.classList.remove('theme-classic', 'theme-neon', 'theme-atlantic', 'theme-monte');
    const t = THEMES[themeId] || THEMES.classic;
    document.body.classList.add(t.bodyClass);
    this.save.settings.theme = themeId;
    this.updateThemeBrandingLabel();
  }

  setRules(partial, silent = false) {
    this.save.settings.rules = { ...this.rules, ...partial };
    this.persist();
    if (!silent && rulesDifferFromChart(this.rules))
      this.toast('Rules updated — strategy chart may not apply', 'info', 2500);
    this.updateSettingsAdvisory();
  }

  modeLabel() {
    const drill = this.save.sessionDrill;
    if (drill) return `Drill: ${PRACTICE_DRILLS.find(d => d.id === drill)?.name || drill}`;
    if (this.sessionMode === 'tables' && this.session?.tableTierId) {
      const tier = getTableTier(this.session.tableTierId);
      return tier ? `Table: ${tier.name}` : MODE_LABELS.tables;
    }
    if (this.sessionMode === 'special-event' && this.session?.specialEventId) {
      const ev = SPECIAL_EVENTS.find(e => e.id === this.session.specialEventId);
      return ev ? `Event: ${ev.name}` : MODE_LABELS['special-event'];
    }
    if (this.sessionMode === 'dealer-mode') return MODE_LABELS['dealer-mode'];
    if (this.sessionMode === 'tournament') {
      const opp = this.save.tournament?.match?.opponentName;
      return opp ? `Tournament vs ${opp}` : 'Tournament Duel';
    }
    return MODE_LABELS[this.sessionMode] || (this.practice ? 'Practice' : 'Full Game');
  }

  renderCurrencyDisplays() {
    const w = formatWalletShort(this.save);
    const chipsText = this.practice ? `∞ ${w.chips}` : `🪙 ${w.chips}`;
    const gemsText = `💎 ${w.gems}`;
    const menuChips = document.getElementById('menu-chips');
    const menuGems = document.getElementById('menu-gems');
    if (menuChips) menuChips.textContent = chipsText;
    if (menuGems) menuGems.textContent = gemsText;
    const hChips = document.getElementById('header-chips');
    const hGems = document.getElementById('header-gems');
    if (hChips) hChips.textContent = chipsText;
    if (hGems) hGems.textContent = gemsText;
  }

  openTableLobby() {
    this.phase = 'table-lobby';
    this.render();
  }

  openTournament() {
    this.phase = 'tournament';
    this.render();
  }

  async copyTournamentInvite() {
    const result = createTournamentInvite(this.save);
    if (!result.ok) {
      this.toast('Could not create tournament invite', 'error');
      return;
    }
    this.persist();
    const url = result.url;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else throw new Error('clipboard unavailable');
      this.toast('Tournament invite link copied!', 'success', 4000);
    } catch {
      prompt('Copy tournament invite link:', url);
      this.toast('Copy the invite link from the dialog', 'info', 4000);
    }
  }

  openSpecialEvent() {
    ensureSpecialEventProgress(this.save);
    this.phase = 'special-event';
    this.render();
  }

  renderSpecialEvent() {
    const event = getCurrentSpecialEvent();
    const tier = getSpecialEventTier(event);
    const progress = ensureSpecialEventProgress(this.save);
    const w = getWallet(this.save);
    const subtitle = document.getElementById('special-event-subtitle');
    if (subtitle) {
      subtitle.textContent = `Week ${clubWeekKey()} · ${formatSpecialEventCountdown()} left · ${SPECIAL_EVENTS.length} events rotate`;
    }
    const hero = document.getElementById('special-event-hero');
    if (hero && event) {
      if (isDealerEventActive(event)) {
        hero.innerHTML = `
          <div class="flex gap-3 items-start">
            <span class="text-4xl">${event.icon}</span>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-gold text-xl">${event.name}</h3>
              <p class="text-xs text-amber-300/90 mt-0.5 font-mono">${event.tagline}</p>
              <p class="text-sm text-emerald-100/90 mt-2">${event.desc}</p>
              <p class="text-[11px] text-cyan-300/80 mt-2 font-mono">
                ${event.rewardMultiplier || 1}× chip rewards · +${event.bonusGemsOnShift || 0} 💎 at ${event.bonusGemsThreshold || 95}%+ payout accuracy
              </p>
              <p class="text-xs text-emerald-400/70 mt-2">Balance: 🪙 ${w.chips.toLocaleString()} · 💎 ${w.gems}</p>
              <button type="button" id="btn-special-event-join" class="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-bold">
                Start Dealer Shift
              </button>
            </div>
          </div>`;
        document.getElementById('btn-special-event-join')?.addEventListener('click', () => this.joinSpecialEventDealerShift());
      } else if (tier) {
        const check = canJoinTable(this.save, tier);
        const base = getTableTier(event.baseTierId);
        const pot = tier.entryFeeChips * 2;
        const win = calcTableWinPayout(tier.entryFeeChips, event.winMultiplier);
        const saved = base && tier.entryFeeChips < base.entryFeeChips
          ? ` (was ${base.entryFeeChips.toLocaleString()})` : '';
        hero.innerHTML = `
          <div class="flex gap-3 items-start">
            <span class="text-4xl">${event.icon}</span>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-gold text-xl">${event.name}</h3>
              <p class="text-xs text-violet-300/90 mt-0.5 font-mono">${event.tagline}</p>
              <p class="text-sm text-emerald-100/90 mt-2">${event.desc}</p>
              <p class="text-[11px] text-cyan-300/80 mt-2 font-mono">
                Entry ${tier.entryFeeChips.toLocaleString()} 🪙${saved}
                ${tier.entryFeeGems ? ` + ${tier.entryFeeGems} 💎` : ''}
                → pot ${pot.toLocaleString()} · win ${win.toLocaleString()} (${event.winMultiplier}×)
                ${event.bonusGemsOnWin ? ` · +${event.bonusGemsOnWin} 💎 bonus` : ''}
              </p>
              <p class="text-xs text-emerald-400/70 mt-2">Balance: 🪙 ${w.chips.toLocaleString()} · 💎 ${w.gems}</p>
              ${!check.ok ? `<p class="text-xs text-amber-300/90 mt-2">🔒 ${check.reasons[0]}</p>` : ''}
              <button type="button" id="btn-special-event-join" class="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white font-bold" ${check.ok ? '' : 'disabled'}>
                Join Event Table
              </button>
            </div>
          </div>`;
        document.getElementById('btn-special-event-join')?.addEventListener('click', () => this.joinSpecialEventTable());
      }
    }
    const dailyPanel = document.getElementById('special-event-daily-panel');
    if (dailyPanel) {
      const dailyDone = this.save.daily?.completed;
      dailyPanel.innerHTML = `
        <p class="text-xs uppercase tracking-wider text-amber-400/80">Daily Challenge</p>
        <p class="text-sm text-emerald-100/90">Stack event wins with today's daily goal for extra crew points.</p>
        <button type="button" id="btn-special-event-daily" class="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-bold">
          ${dailyDone ? '✓ Daily complete — view challenge' : 'Open Daily Challenge'}
        </button>`;
      document.getElementById('btn-special-event-daily')?.addEventListener('click', () => this.openDaily());
    }
    const stats = document.getElementById('special-event-stats');
    if (stats) {
      const nextIdx = (specialEventWeekIndex() + 1) % SPECIAL_EVENTS.length;
      const next = SPECIAL_EVENTS[nextIdx];
      stats.innerHTML = `
        <p class="uppercase text-cyan-400/80 mb-2">Your event week</p>
        <div class="grid grid-cols-${isDealerEventActive(event) ? '3' : '3'} gap-2 text-center">
          ${isDealerEventActive(event)
            ? `<div><div class="font-mono text-gold text-lg">${progress.dealerShifts || 0}</div><div class="text-[10px] text-emerald-500/70">Shifts</div></div>
              <div><div class="font-mono text-gold text-lg">${progress.dealerBestAcc || 0}%</div><div class="text-[10px] text-emerald-500/70">Best accuracy</div></div>
              <div><div class="font-mono text-gold text-lg">${progress.gemsEarned}</div><div class="text-[10px] text-emerald-500/70">💎 earned</div></div>`
            : `<div><div class="font-mono text-gold text-lg">${progress.wins}</div><div class="text-[10px] text-emerald-500/70">Wins</div></div>
              <div><div class="font-mono text-gold text-lg">${progress.attempts}</div><div class="text-[10px] text-emerald-500/70">Attempts</div></div>
              <div><div class="font-mono text-gold text-lg">${progress.gemsEarned}</div><div class="text-[10px] text-emerald-500/70">💎 earned</div></div>`}
        </div>
        <p class="text-[10px] text-emerald-500/60 mt-3 text-center">Next event: ${next.icon} ${next.name}</p>`;
    }
  }

  joinSpecialEventTable() {
    const event = getCurrentSpecialEvent();
    const tier = getSpecialEventTier(event);
    const base = getTableTier(event?.baseTierId);
    if (!tier || !base || !event) return;
    const paid = payTableEntry(this.save, base, {
      entryFeeChips: tier.entryFeeChips,
      entryFeeGems: tier.entryFeeGems,
      winMultiplier: event.winMultiplier,
    });
    if (!paid.ok) {
      this.toast(paid.error || 'Cannot join event table', 'error');
      this.renderSpecialEvent();
      return;
    }
    ensureSpecialEventProgress(this.save);
    this.save.specialEvent.attempts += 1;
    this.save.settings.practiceMode = false;
    this.save.sessionMode = 'special-event';
    this.save.sessionDrill = null;
    this.save.sessionTableTier = tier.id;
    this.save.settings.minBet = tier.minBet;
    this.save.settings.unitSize = tier.unitSize;
    this.applyTheme(tier.theme);
    this.save.sessionActive = true;
    this.save.sessionHands = 0;
    this.save.sessionNetPL = 0;
    this.bankroll = this.chips;
    this.session = {
      start: this.chips,
      wagered: 0,
      netPL: 0,
      hands: 0,
      insTaken: 0,
      insWon: 0,
      decisions: 0,
      decisionsCorrect: 0,
      countQuizCorrect: 0,
      countQuizTotal: 0,
      betStreak: 0,
      tableTierId: tier.id,
      tableEntryFee: tier.entryFeeChips,
      tableEntryGems: tier.entryFeeGems,
      tablePot: paid.pot,
      tableWinPayout: paid.winPayout,
      tableWinMultiplier: event.winMultiplier,
      tableBonusGemsOnWin: event.bonusGemsOnWin || 0,
      tableMaxBet: tier.maxBet,
      specialEventId: event.id,
    };
    this.shoe = new Shoe(this.settings.numDecks);
    this.counter = this.createCounter();
    this.help = new HelpSystem(this.stats.helpLevel, 'normal');
    this.initializeCounterFromBurnedCards();
    this.persist();
    Sounds.play('chip');
    const gemPart = event.bonusGemsOnWin ? ` · +${event.bonusGemsOnWin} 💎 on win` : '';
    this.toast(
      `${event.name} — entry ${tier.entryFeeChips.toLocaleString()} chips. Win for ${paid.winPayout.toLocaleString()} (${event.winMultiplier}×)${gemPart}!`,
      'info',
      4500,
    );
    this.beginBetPhase();
  }

  joinSpecialEventDealerShift() {
    const event = getCurrentSpecialEvent();
    if (!isDealerEventActive(event)) return;
    ensureSpecialEventProgress(this.save);
    this.save.specialEvent.attempts += 1;
    this.dealerEventActive = event.id;
    lobbyTapFeedback('whoosh');
    this.openDealerMode('lobby');
    this.toast(`${event.name} — boosted shift rewards!`, 'level', 3500);
  }

  // ── Dealer Mode (player as dealer) ─────────────────────────────
  stopDealerTimer() {
    if (this._dealerTimerId != null) {
      clearInterval(this._dealerTimerId);
      this._dealerTimerId = null;
    }
  }

  startDealerTimer(durationMs, label, onExpire) {
    this.stopDealerTimer();
    const ds = this.dealerSession;
    if (!ds) return;
    ds.timerLabel = label;
    ds.timerEnds = Date.now() + durationMs;
    const tick = () => {
      const left = Math.max(0, ds.timerEnds - Date.now());
      const pct = Math.max(0, (left / durationMs) * 100);
      const fill = document.getElementById('dealer-timer-fill');
      const secs = document.getElementById('dealer-timer-seconds');
      const lbl = document.getElementById('dealer-timer-label');
      if (fill) {
        fill.style.width = `${pct}%`;
        fill.classList.toggle('urgent', left < 2500);
      }
      if (secs) secs.textContent = `${(left / 1000).toFixed(1)}s`;
      if (lbl) lbl.textContent = label;
      if (left <= 0) {
        this.stopDealerTimer();
        onExpire?.();
      }
    };
    tick();
    this._dealerTimerId = setInterval(tick, 100);
  }

  openDealerMode(from = 'training') {
    this.stopDealerTimer();
    this.dealerSession = null;
    this.dealerEntryFrom = from;
    this.phase = 'dealer-mode';
    this.save.sessionMode = from === 'lobby' ? 'lobby' : 'training';
    this.render();
  }

  dealerGoBack() {
    this.stopDealerTimer();
    this.dealerSession = null;
    if (this.dealerEntryFrom === 'lobby') this.goMenu();
    else this.openTrainingMode();
  }

  renderDealerMiniCard(c, hidden = false) {
    if (hidden) return '<div class="dealer-mini-card back">?</div>';
    const red = c.suit === 'H' || c.suit === 'D';
    return `<div class="dealer-mini-card ${red ? 'red' : ''}">${c.rank}</div>`;
  }

  renderDealerMode() {
    const intro = document.getElementById('dealer-mode-intro');
    const active = document.getElementById('dealer-mode-active');
    const summary = document.getElementById('dealer-mode-summary');
    const ds = this.dealerSession;
    const view = ds?.view || 'intro';
    intro?.classList.toggle('hidden', view !== 'intro');
    active?.classList.toggle('hidden', view !== 'active');
    summary?.classList.toggle('hidden', view !== 'summary');

    if (view === 'intro') {
      const backBtn = document.getElementById('btn-dealer-mode-back');
      if (backBtn) backBtn.textContent = this.dealerEntryFrom === 'lobby' ? '← Lobby' : '← Training Mode';
      const meta = document.getElementById('dealer-mode-intro-meta');
      if (meta) {
        const evNote = this.dealerEventActive && isDealerEventActive(getCurrentSpecialEvent())
          ? ` · ${getCurrentSpecialEvent().name} event active` : '';
        meta.textContent = `House bank ${DEALER_MODE.startBank.toLocaleString()} · ${DEALER_MODE.handsPerSession} hands · ${DEALER_MODE.payoutTimeMs / 1000}s per payout · earn chips for accuracy${evNote}`;
      }
      const career = document.getElementById('dealer-mode-career-stats');
      const st = this.save.dealerMode || defaultDealerModeStats();
      if (career) {
        career.innerHTML = st.sessionsPlayed
          ? `<p class="uppercase text-xs text-cyan-400/80 mb-2">Career Stats</p>
            <div class="grid grid-cols-2 gap-2 text-center">
              <div><div class="font-mono text-gold text-lg">${st.sessionsPlayed}</div><div class="text-[10px] text-emerald-500/70">Shifts</div></div>
              <div><div class="font-mono text-gold text-lg">${st.bestPayoutAccuracy}%</div><div class="text-[10px] text-emerald-500/70">Best payout accuracy</div></div>
            </div>`
          : '<p class="text-center text-emerald-500/60">Complete your first shift to unlock career stats.</p>';
      }
      return;
    }

    if (view === 'summary' && ds) {
      const body = document.getElementById('dealer-summary-body');
      const last = this.save.dealerMode?.lastSession;
      if (body && last) {
        const payoutAcc = ds.analytics.payoutTotal
          ? Math.round(100 * ds.analytics.payoutCorrect / ds.analytics.payoutTotal) : 0;
        const countAcc = ds.analytics.countTotal
          ? Math.round(100 * ds.analytics.countCorrect / ds.analytics.countTotal) : 0;
        const actionAcc = ds.analytics.dealerActionTotal
          ? Math.round(100 * ds.analytics.dealerActionCorrect / ds.analytics.dealerActionTotal) : null;
        const avgMs = ds.analytics.responseCount
          ? Math.round(ds.analytics.responseMsSum / ds.analytics.responseCount) : 0;
        body.innerHTML = `
          <div class="dealer-analytics-grid">
            <div><div class="stat-val">${payoutAcc}%</div><div class="stat-lbl">Payout accuracy</div></div>
            <div><div class="stat-val">${countAcc}%</div><div class="stat-lbl">Count accuracy</div></div>
            <div><div class="stat-val">${avgMs}ms</div><div class="stat-lbl">Avg response</div></div>
          </div>
          <div class="text-sm space-y-1 mt-3">
            <div class="flex justify-between"><span>Hands managed</span><span class="font-mono text-gold">${ds.handsPlayed}</span></div>
            <div class="flex justify-between"><span>House P/L</span><span class="font-mono ${last.housePL >= 0 ? 'text-green-400' : 'text-red-300'}">${last.housePL >= 0 ? '+' : ''}${last.housePL.toLocaleString()}</span></div>
            ${actionAcc != null ? `<div class="flex justify-between"><span>Dealer rule quiz</span><span class="font-mono text-gold">${actionAcc}%</span></div>` : ''}
            <div class="flex justify-between"><span>Final bank</span><span class="font-mono text-emerald-200">${ds.houseBank.toLocaleString()}</span></div>
          </div>
          <p class="text-xs text-emerald-400/70 mt-3 text-center">${last.early ? 'Shift ended early.' : 'Full shift complete — sharp eyes at the table!'}</p>`;
      }
      return;
    }

    if (view !== 'active' || !ds) return;

    const bank = document.getElementById('dealer-bank-bar');
    if (bank) {
      const pl = ds.houseBank - ds.startBank;
      bank.innerHTML = `
        <div class="text-xs"><span class="text-emerald-400/70">House Bank</span> <span class="font-mono font-bold text-gold text-lg">${ds.houseBank.toLocaleString()}</span></div>
        <div class="text-xs"><span class="text-emerald-400/70">Hand</span> <span class="font-mono text-emerald-200">${ds.handsPlayed + 1}/${ds.targetHands}</span></div>
        <div class="text-xs"><span class="text-emerald-400/70">Session P/L</span> <span class="font-mono ${pl >= 0 ? 'text-green-400' : 'text-red-300'}">${pl >= 0 ? '+' : ''}${pl.toLocaleString()}</span></div>
        <div class="text-xs"><span class="text-emerald-400/70">Payout score</span> <span class="font-mono text-amber-300">${ds.analytics.payoutTotal ? Math.round(100 * ds.analytics.payoutCorrect / ds.analytics.payoutTotal) : 100}%</span></div>`;
    }

    const hud = document.getElementById('dealer-count-hud');
    if (hud && ds.counter && ds.shoe) {
      const snap = ds.counter.getCountSnapshot(ds.shoe);
      const rs = snap.runningCount >= 0 ? `+${snap.runningCount}` : `${snap.runningCount}`;
      const tc = snap.trueCount >= 0 ? `+${snap.trueCount.toFixed(1)}` : snap.trueCount.toFixed(1);
      hud.innerHTML = `
        <div class="text-center py-2 px-3 rounded-xl bg-black/35 border border-emerald-700/25">
          <div class="text-[10px] uppercase text-emerald-400/60">Running Count</div>
          <div class="font-mono font-bold text-lg text-emerald-200">${rs}</div>
        </div>
        <div class="text-center py-2 px-3 rounded-xl bg-black/35 border border-emerald-700/25">
          <div class="text-[10px] uppercase text-emerald-400/60">True Count</div>
          <div class="font-mono font-bold text-lg text-emerald-200">${tc}</div>
        </div>
        <div class="text-center py-2 px-3 rounded-xl bg-black/35 border border-emerald-700/25">
          <div class="text-[10px] uppercase text-emerald-400/60">Decks Left</div>
          <div class="font-mono font-bold text-lg text-emerald-200">${snap.decksRemaining.toFixed(2)}</div>
        </div>
        <div class="text-center py-2 px-3 rounded-xl bg-black/35 border border-emerald-700/25">
          <div class="text-[10px] uppercase text-emerald-400/60">Cards Seen</div>
          <div class="font-mono font-bold text-lg text-emerald-200">${snap.cardsCounted}</div>
        </div>`;
    }

    const dCards = document.getElementById('dealer-mode-dealer-cards');
    const dTotal = document.getElementById('dealer-mode-dealer-total');
    if (dCards) {
      dCards.innerHTML = ds.dealerHand.cards.map((c, i) =>
        this.renderDealerMiniCard(c, ds.holeHidden && i === 1)
      ).join('') || '<span class="text-xs text-emerald-500/50">—</span>';
    }
    if (dTotal) {
      dTotal.textContent = ds.holeHidden && ds.dealerHand.size >= 2
        ? `Showing ${ds.dealerHand.cards[0]?.rank || '?'} + hole`
        : (ds.dealerHand.size ? `${ds.dealerHand.beginnerDisplaySummary()}` : '');
    }

    const grid = document.getElementById('dealer-seat-grid');
    if (grid) {
      const activeItem = ds.roundPhase === 'payout' ? ds.payoutQueue[ds.payoutIdx] : null;
      grid.innerHTML = ds.seats.map(seat => {
        const totalBet = dealerSeatTotalBet(seat);
        const handBlocks = (seat.hands || []).map((hs, hi) => {
          const cards = hs?.hand?.cards || [];
          const active = activeItem?.seatId === seat.id && activeItem?.handIdx === hi;
          return `<div class="dealer-seat-hand ${active ? 'active-payout' : ''}">
            ${seat.hands.length > 1 ? `<div class="text-[9px] text-cyan-400/70 mb-0.5">Hand ${hi + 1}</div>` : ''}
            <div class="dealer-seat-cards">${cards.map(c => this.renderDealerMiniCard(c)).join('') || '—'}</div>
            <div class="text-[10px] font-mono text-emerald-300/70">${hs?.hand?.size ? hs.hand.value() : ''}${hs?.doubled ? ' ×2' : ''}</div>
          </div>`;
        }).join('');
        const insLabel = seat.insurance > 0 ? `<div class="text-[9px] text-amber-300/80">Ins $${seat.insurance}</div>` : '';
        return `<div class="dealer-seat ${activeItem?.seatId === seat.id ? 'active-payout' : ''}">
          <div class="dealer-seat-name">${seat.avatar} ${seat.name}</div>
          <div class="dealer-seat-bet">$${totalBet}</div>
          ${insLabel}
          ${handBlocks || '<div class="dealer-seat-cards">—</div>'}
        </div>`;
      }).join('');
    }

    const timerWrap = document.getElementById('dealer-timer-wrap');
    const showTimer = ['payout', 'dealer-quiz', 'countQuiz', 'insurance-payout'].includes(ds.roundPhase);
    timerWrap?.classList.toggle('hidden', !showTimer);

    const panel = document.getElementById('dealer-action-panel');
    if (panel) {
      if (ds.roundPhase === 'betting') {
        panel.innerHTML = '<p class="text-center text-sm text-emerald-200/90">Players placing bets…</p>';
      } else if (ds.roundPhase === 'insurance') {
        const takers = ds.seats.filter(s => s.insurance > 0);
        panel.innerHTML = `<p class="text-center text-sm text-gold font-bold mb-1">Insurance offered — Ace showing</p>
          <p class="text-center text-xs text-emerald-300/80">${takers.length ? takers.map(s => `${s.name} $${s.insurance}`).join(' · ') : 'No players took insurance'}</p>`;
      } else if (ds.roundPhase === 'peek') {
        panel.innerHTML = '<p class="text-center text-sm text-amber-200/90">Peeking at hole card…</p>';
      } else if (ds.roundPhase === 'insurance-payout') {
        const item = ds.insuranceQueue?.[ds.insuranceIdx];
        if (item) {
          const dealerBJ = ds.dealerHand.isBlackjack();
          panel.innerHTML = `
            <p class="text-center text-sm text-gold font-bold mb-1">Insurance — ${item.seatAvatar} ${item.seatName}</p>
            <p class="text-center text-xs text-emerald-300/80 mb-1">Bet $${item.insuranceBet} · Dealer ${dealerBJ ? 'BJ' : 'no BJ'}</p>
            <p class="text-center text-[10px] text-amber-300/80 mb-3">${ds.insuranceIdx + 1} of ${ds.insuranceQueue.length}</p>
            <div class="grid grid-cols-2 gap-2">
              ${DEALER_INSURANCE_OPTIONS.map(o =>
                `<button type="button" class="dealer-pay-btn ${o.cls}" data-dealer-insurance="${o.id}">${o.label}</button>`
              ).join('')}
            </div>`;
        }
      } else if (ds.roundPhase === 'dealing' || ds.roundPhase === 'players' || ds.roundPhase === 'dealer-action') {
        panel.innerHTML = `<p class="text-center text-sm text-emerald-200/90">${ds.roundPhase === 'dealing' ? 'Dealing cards…' : ds.roundPhase === 'players' ? 'Players acting…' : 'Dealer drawing…'}</p>`;
      } else if (ds.roundPhase === 'dealer-quiz') {
        const pr = dealerActionPrompt(ds.dealerHand, ds.rules);
        panel.innerHTML = `
          <p class="text-center text-sm text-gold font-bold mb-2">Dealer Rule Check — ${pr.label}</p>
          <p class="text-center text-xs text-emerald-300/80 mb-3">What must the house do? (${DEALER_MODE.dealerActionTimeMs / 1000}s)</p>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="dealer-pay-btn dealer-pay-win" data-dealer-action="hit">Hit</button>
            <button type="button" class="dealer-pay-btn dealer-pay-push" data-dealer-action="stand">Stand</button>
          </div>`;
      } else if (ds.roundPhase === 'payout') {
        const item = ds.payoutQueue[ds.payoutIdx];
        if (item) {
          panel.innerHTML = `
            <p class="text-center text-sm text-gold font-bold mb-1">Pay ${item.seatAvatar} ${item.seatName}</p>
            <p class="text-center text-xs text-emerald-300/80 mb-1">Bet $${item.bet} · Player ${item.playerHand.value()} vs Dealer ${ds.dealerHand.value()}</p>
            <p class="text-center text-[10px] text-amber-300/80 mb-3">Hand ${ds.payoutIdx + 1} of ${ds.payoutQueue.length}</p>
            <div class="grid grid-cols-2 gap-2">
              ${DEALER_PAYOUT_OPTIONS.map(o =>
                `<button type="button" class="dealer-pay-btn ${o.cls}" data-dealer-payout="${o.id}">${o.label}</button>`
              ).join('')}
            </div>`;
        }
      } else if (ds.roundPhase === 'countQuiz') {
        panel.innerHTML = `
          <p class="text-center text-sm text-gold font-bold mb-2">Count Check — Dealer View</p>
          <p class="text-center text-xs text-emerald-300/80 mb-3">You've seen every card. Running count? (±1 counts correct)</p>
          <input id="dealer-count-quiz-input" type="number" class="w-full px-3 py-2 rounded-lg bg-black/30 text-white mb-2 text-center font-mono" placeholder="e.g. +4" />
          <button type="button" id="btn-dealer-count-submit" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-bold">Submit Count</button>`;
      } else {
        panel.innerHTML = '<p class="text-center text-xs text-emerald-500/60">Preparing next hand…</p>';
      }
    }

    const log = document.getElementById('dealer-round-log');
    if (log) log.textContent = ds.log || '';
  }

  startDealerShift() {
    Sounds.init();
    Sounds.play('chip');
    lobbyTapFeedback('whoosh');
    this.markDrillSessionStart();
    const seatCount = randomDealerSeatCount();
    const curEvent = getCurrentSpecialEvent();
    const eventMode = this.dealerEventActive === curEvent?.id && isDealerEventActive(curEvent) ? curEvent : null;
    this.dealerSession = {
      view: 'active',
      roundPhase: 'betting',
      eventMode,
      houseBank: DEALER_MODE.startBank,
      startBank: DEALER_MODE.startBank,
      handsPlayed: 0,
      targetHands: DEALER_MODE.handsPerSession,
      seats: createDealerAISeats(seatCount),
      dealerHand: new Hand(),
      shoe: new Shoe(this.settings.numDecks),
      counter: this.createCounter(),
      rules: { ...this.rules },
      holeHidden: true,
      payoutQueue: [],
      payoutIdx: 0,
      insuranceQueue: [],
      insuranceIdx: 0,
      roundHousePL: 0,
      analytics: {
        payoutCorrect: 0, payoutTotal: 0,
        insuranceCorrect: 0, insuranceTotal: 0,
        countCorrect: 0, countTotal: 0,
        dealerActionCorrect: 0, dealerActionTotal: 0,
        responseMsSum: 0, responseCount: 0,
      },
      phaseStartedAt: Date.now(),
      dealerUpRank: null,
      log: '',
    };
    for (const c of this.dealerSession.shoe.burnedCards || []) {
      this.dealerSession.counter.recordCardRemovedFromShoe(c);
    }
    this.save.sessionActive = true;
    this.save.sessionMode = 'dealer-mode';
    this.persist();
    this.renderDealerMode();
    setTimeout(() => this.runDealerRound(), 500);
  }

  dealerDealCard(hand) {
    const ds = this.dealerSession;
    const card = ds.shoe.deal();
    ds.counter.recordCardRemovedFromShoe(card);
    hand.add(card);
    Sounds.play('card');
    return card;
  }

  dealerPlaceBets() {
    const ds = this.dealerSession;
    const snap = ds.counter.getCountSnapshot(ds.shoe);
    for (const seat of ds.seats) {
      const bet = dealerAIBetForSeat(snap, DEALER_MODE.minBet, DEALER_MODE.maxBet);
      seat.bet = bet;
      seat.insurance = 0;
      seat.hands = [{
        hand: new Hand(), bet, finished: false,
        doubled: false, fromSplit: false, splitAces: false, surrendered: false,
      }];
    }
  }

  async dealerDealRound() {
    const ds = this.dealerSession;
    for (const seat of ds.seats) {
      this.dealerDealCard(seat.hands[0].hand);
      this.renderDealerMode();
      await sleep(220);
    }
    this.dealerDealCard(ds.dealerHand);
    this.renderDealerMode();
    await sleep(220);
    for (const seat of ds.seats) {
      this.dealerDealCard(seat.hands[0].hand);
      this.renderDealerMode();
      await sleep(220);
    }
    this.dealerDealCard(ds.dealerHand);
    ds.holeHidden = true;
    this.renderDealerMode();
    await sleep(350);
  }

  async dealerAISplitHand(seat, handIdx) {
    const hs = seat.hands[handIdx];
    const [a, b] = hs.hand.cards;
    const isAces = a.rank === 'A';
    const h1 = new Hand([a]);
    const h2 = new Hand([b]);
    this.dealerDealCard(h1);
    this.dealerDealCard(h2);
    seat.hands.splice(handIdx, 1,
      { hand: h1, bet: hs.bet, finished: isAces, doubled: false, fromSplit: true, splitAces: isAces, surrendered: false },
      { hand: h2, bet: hs.bet, finished: isAces, doubled: false, fromSplit: true, splitAces: isAces, surrendered: false },
    );
    seat.bet = dealerSeatTotalBet(seat);
  }

  async dealerPlayAIPlayers() {
    const ds = this.dealerSession;
    const up = ds.dealerUpRank;
    for (const seat of ds.seats) {
      let guard = 0;
      while (seat.hands.some(h => !h.finished) && guard++ < 60) {
        const hi = seat.hands.findIndex(h => !h.finished);
        if (hi < 0) break;
        const hs = seat.hands[hi];
        if (hs.hand.isBlackjack()) { hs.finished = true; continue; }
        const action = dealerModeAIStrategyAction(hs, up, ds.rules, dealerSeatSplitCount(seat));
        if (action === 'split') {
          await this.dealerAISplitHand(seat, hi);
          this.renderDealerMode();
          await sleep(450);
          continue;
        }
        if (action === 'double') {
          hs.doubled = true;
          hs.bet *= 2;
          seat.bet = dealerSeatTotalBet(seat);
          this.dealerDealCard(hs.hand);
          hs.finished = true;
        } else if (action === 'hit') {
          this.dealerDealCard(hs.hand);
          if (hs.hand.isBust() || hs.hand.is21()) hs.finished = true;
        } else {
          hs.finished = true;
        }
        this.renderDealerMode();
        await sleep(380);
      }
      seat.bet = dealerSeatTotalBet(seat);
    }
  }

  async dealerDrawToCompletion() {
    const ds = this.dealerSession;
    ds.holeHidden = false;
    this.renderDealerMode();
    await sleep(450);
    while (dealerShouldHit(ds.dealerHand, ds.rules)) {
      this.dealerDealCard(ds.dealerHand);
      this.renderDealerMode();
      await sleep(420);
    }
  }

  async dealerCollectInsurance() {
    const ds = this.dealerSession;
    const snap = ds.counter.getCountSnapshot(ds.shoe);
    ds.roundPhase = 'insurance';
    for (const seat of ds.seats) {
      seat.insurance = 0;
      const mainBet = seat.hands[0]?.bet || DEALER_MODE.minBet;
      if (dealerAITakesInsurance(snap)) {
        seat.insurance = Math.max(1, Math.floor(mainBet / 2));
      }
    }
    this.renderDealerMode();
    await sleep(900);
  }

  async dealerPeekHole() {
    const ds = this.dealerSession;
    if (!dealerUpShowsPeek(ds.dealerUpRank)) return false;
    ds.roundPhase = 'peek';
    this.renderDealerMode();
    await sleep(700);
    const hasBJ = dealerHasNaturalBlackjack(ds.dealerHand);
    if (hasBJ) {
      ds.holeHidden = false;
      this.renderDealerMode();
      await sleep(500);
      this.toast('Peek — dealer blackjack!', 'info', 2800);
      Sounds.play('loss');
    }
    return hasBJ;
  }

  async dealerAfterDealChecks() {
    const ds = this.dealerSession;
    ds.dealerUpRank = ds.dealerHand.cards[0]?.rank;
    if (ds.dealerUpRank === 'A') {
      await this.dealerCollectInsurance();
      const dealerBJ = await this.dealerPeekHole();
      if (dealerBJ) {
        for (const seat of ds.seats) {
          for (const hs of seat.hands) {
            if (!hs.hand.isBlackjack()) hs.finished = true;
          }
        }
        this.beginDealerPayoutPhase();
        return true;
      }
      return false;
    }
    if (dealerUpShowsPeek(ds.dealerUpRank)) {
      const dealerBJ = await this.dealerPeekHole();
      if (dealerBJ) {
        ds.holeHidden = false;
        for (const seat of ds.seats) {
          for (const hs of seat.hands) {
            if (!hs.hand.isBlackjack()) hs.finished = true;
          }
        }
        this.beginDealerPayoutPhase();
        return true;
      }
    }
    return false;
  }

  async runDealerRound() {
    const ds = this.dealerSession;
    if (!ds || ds.view !== 'active') return;
    if (ds.handsPlayed >= ds.targetHands || ds.shoe.needsReshuffle()) {
      this.endDealerShift(false);
      return;
    }
    ds.roundPhase = 'betting';
    ds.dealerHand = new Hand();
    ds.holeHidden = true;
    ds.payoutQueue = [];
    ds.payoutIdx = 0;
    ds.roundHousePL = 0;
    this.renderDealerMode();
    await sleep(700);
    this.dealerPlaceBets();
    ds.roundPhase = 'dealing';
    this.renderDealerMode();
    await this.dealerDealRound();
    if (await this.dealerAfterDealChecks()) return;
    ds.roundPhase = 'players';
    this.renderDealerMode();
    await this.dealerPlayAIPlayers();
    ds.roundPhase = 'dealer-action';
    this.renderDealerMode();
    await sleep(400);
    const prompt = dealerActionPrompt(ds.dealerHand, ds.rules);
    if (!prompt.obvious && ds.dealerHand.value() <= 21) {
      ds.roundPhase = 'dealer-quiz';
      ds.phaseStartedAt = Date.now();
      this.renderDealerMode();
      this.startDealerTimer(DEALER_MODE.dealerActionTimeMs, 'Dealer rule', () => this.submitDealerAction(null));
      return;
    }
    await this.dealerDrawToCompletion();
    this.beginDealerPayoutPhase();
  }

  submitDealerAction(guess) {
    this.stopDealerTimer();
    const ds = this.dealerSession;
    if (!ds || ds.roundPhase !== 'dealer-quiz') return;
    const prompt = dealerActionPrompt(ds.dealerHand, ds.rules);
    const elapsed = Date.now() - ds.phaseStartedAt;
    ds.analytics.dealerActionTotal++;
    ds.analytics.responseMsSum += elapsed;
    ds.analytics.responseCount++;
    if (guess) {
      const ok = guess === prompt.correct;
      if (ok) ds.analytics.dealerActionCorrect++;
      else {
        recordMistakeReviewEntry(this.save, {
          drillId: 'dealer-mode',
          category: 'dealer',
          context: `Dealer ${prompt.label} vs upcard`,
          wrong: guess,
          correct: prompt.correct,
          detail: `House must ${prompt.correct} on ${prompt.label}`,
        });
      }
      this.toast(ok ? `✓ Dealer must ${prompt.correct}` : `✗ Dealer must ${prompt.correct}`, ok ? 'success' : 'error', 2800);
    } else {
      recordMistakeReviewEntry(this.save, {
        drillId: 'dealer-mode',
        category: 'dealer',
        context: `Dealer ${prompt.label} (timed out)`,
        wrong: '—',
        correct: prompt.correct,
        detail: `Time expired — house must ${prompt.correct}`,
      });
      this.toast(`Time! Dealer must ${prompt.correct}`, 'error', 2800);
    }
    ds.roundPhase = 'dealer-action';
    this.dealerDrawToCompletion().then(() => this.beginDealerPayoutPhase());
  }

  beginDealerPayoutPhase() {
    const ds = this.dealerSession;
    if (!ds) return;
    ds.holeHidden = false;
    ds.payoutQueue = [];
    for (const seat of ds.seats) {
      for (let hi = 0; hi < seat.hands.length; hi++) {
        const hs = seat.hands[hi];
        if (hs.surrendered) continue;
        ds.payoutQueue.push({
          seatId: seat.id,
          seatName: seat.name,
          seatAvatar: seat.avatar,
          handIdx: hi,
          playerHand: hs.hand,
          bet: hs.bet,
          fromSplit: hs.fromSplit,
        });
      }
    }
    if (!ds.payoutQueue.length) {
      this.beginDealerInsurancePayoutPhase();
      return;
    }
    ds.payoutIdx = 0;
    ds.roundPhase = 'payout';
    ds.phaseStartedAt = Date.now();
    this.renderDealerMode();
    this.startDealerTimer(DEALER_MODE.payoutTimeMs, 'Resolve payout', () => this.submitDealerPayout(null));
  }

  submitDealerPayout(guess) {
    this.stopDealerTimer();
    const ds = this.dealerSession;
    if (!ds || ds.roundPhase !== 'payout') return;
    const item = ds.payoutQueue[ds.payoutIdx];
    if (!item) return;
    const elapsed = Date.now() - ds.phaseStartedAt;
    ds.analytics.payoutTotal++;
    ds.analytics.responseMsSum += elapsed;
    ds.analytics.responseCount++;
    const expected = dealerExpectedPlayerResult(item.playerHand, ds.dealerHand, item.fromSplit);
    if (guess) {
      const check = validateDealerPayoutGuess(guess, item.playerHand, ds.dealerHand, item.fromSplit);
      if (check.ok) {
        ds.analytics.payoutCorrect++;
        Sounds.play('chip');
      } else {
        recordMistakeReviewEntry(this.save, {
          drillId: 'dealer-mode',
          category: 'dealer',
          context: `Pay ${item.seatName} · $${item.bet}${item.fromSplit ? ' (split)' : ''}`,
          wrong: dealerResultLabel(check.guess),
          correct: dealerResultLabel(check.expected),
          detail: `Player ${item.playerHand.value()} vs Dealer ${ds.dealerHand.value()}`,
          meta: { seatId: item.seatId, handIdx: item.handIdx },
        });
        this.toast(`✗ Correct: ${dealerResultLabel(check.expected)}`, 'error', 2800);
      }
    } else {
      recordMistakeReviewEntry(this.save, {
        drillId: 'dealer-mode',
        category: 'dealer',
        context: `Pay ${item.seatName} · $${item.bet} (timed out)`,
        wrong: '—',
        correct: dealerResultLabel(expected),
        detail: `Player ${item.playerHand.value()} vs Dealer ${ds.dealerHand.value()}`,
        meta: { seatId: item.seatId, handIdx: item.handIdx },
      });
      this.toast(`Time! ${dealerResultLabel(expected)}`, 'error', 2800);
    }
    const houseDelta = dealerHouseNetForResult(item.bet, expected, ds.rules);
    ds.roundHousePL += houseDelta;
    ds.houseBank += houseDelta;
    ds.payoutIdx++;
    if (ds.payoutIdx >= ds.payoutQueue.length) {
      this.beginDealerInsurancePayoutPhase();
      return;
    }
    ds.phaseStartedAt = Date.now();
    this.renderDealerMode();
    this.startDealerTimer(DEALER_MODE.payoutTimeMs, 'Resolve payout', () => this.submitDealerPayout(null));
  }

  beginDealerInsurancePayoutPhase() {
    const ds = this.dealerSession;
    if (!ds) return;
    const dealerBJ = ds.dealerHand.isBlackjack();
    ds.insuranceQueue = ds.seats.filter(s => s.insurance > 0).map(s => ({
      seatId: s.id,
      seatName: s.name,
      seatAvatar: s.avatar,
      insuranceBet: s.insurance,
      shouldPay: dealerBJ,
    }));
    if (!ds.insuranceQueue.length) {
      this.dealerAdvanceAfterPayouts();
      return;
    }
    ds.insuranceIdx = 0;
    ds.roundPhase = 'insurance-payout';
    ds.phaseStartedAt = Date.now();
    this.renderDealerMode();
    this.startDealerTimer(DEALER_MODE.insuranceTimeMs, 'Insurance payout', () => this.submitDealerInsurancePayout(null));
  }

  submitDealerInsurancePayout(guess) {
    this.stopDealerTimer();
    const ds = this.dealerSession;
    if (!ds || ds.roundPhase !== 'insurance-payout') return;
    const item = ds.insuranceQueue[ds.insuranceIdx];
    if (!item) return;
    const elapsed = Date.now() - ds.phaseStartedAt;
    ds.analytics.insuranceTotal++;
    ds.analytics.responseMsSum += elapsed;
    ds.analytics.responseCount++;
    const correct = item.shouldPay ? 'pay' : 'collect';
    if (guess) {
      const ok = guess === correct;
      if (ok) {
        ds.analytics.insuranceCorrect++;
        Sounds.play('chip');
      } else {
        recordMistakeReviewEntry(this.save, {
          drillId: 'dealer-mode',
          category: 'dealer',
          context: `Insurance ${item.seatName} · $${item.insuranceBet}`,
          wrong: guess === 'pay' ? 'Pay 2:1' : 'Insurance Loses',
          correct: correct === 'pay' ? 'Pay 2:1' : 'Insurance Loses',
          detail: item.shouldPay ? 'Dealer BJ — insurance pays 2:1' : 'No dealer BJ — insurance loses',
        });
        this.toast(`✗ Insurance: ${correct === 'pay' ? 'Pay 2:1' : 'Collect bet'}`, 'error', 2800);
      }
    } else {
      recordMistakeReviewEntry(this.save, {
        drillId: 'dealer-mode',
        category: 'dealer',
        context: `Insurance ${item.seatName} (timed out)`,
        wrong: '—',
        correct: correct === 'pay' ? 'Pay 2:1' : 'Insurance Loses',
        detail: item.shouldPay ? 'Dealer BJ — insurance pays 2:1' : 'No dealer BJ — insurance loses',
      });
      this.toast(`Time! ${correct === 'pay' ? 'Pay 2:1' : 'Insurance loses'}`, 'error', 2800);
    }
    const houseDelta = dealerInsuranceHouseNet(item.insuranceBet, item.shouldPay);
    ds.roundHousePL += houseDelta;
    ds.houseBank += houseDelta;
    ds.insuranceIdx++;
    if (ds.insuranceIdx >= ds.insuranceQueue.length) {
      this.dealerAdvanceAfterPayouts();
      return;
    }
    ds.phaseStartedAt = Date.now();
    this.renderDealerMode();
    this.startDealerTimer(DEALER_MODE.insuranceTimeMs, 'Insurance payout', () => this.submitDealerInsurancePayout(null));
  }

  dealerAdvanceAfterPayouts() {
    const ds = this.dealerSession;
    if (!ds) return;
    ds.handsPlayed++;
    if (ds.handsPlayed % DEALER_MODE.countQuizEvery === 0) {
      ds.roundPhase = 'countQuiz';
      ds.phaseStartedAt = Date.now();
      this.renderDealerMode();
      this.startDealerTimer(DEALER_MODE.countQuizTimeMs, 'Running count', () => this.submitDealerCountQuiz(''));
      return;
    }
    this.finishDealerRound();
  }

  submitDealerCountQuiz(raw) {
    this.stopDealerTimer();
    const ds = this.dealerSession;
    if (!ds || ds.roundPhase !== 'countQuiz') return;
    const actual = ds.counter.runningCount;
    const parsed = validateRunningCountGuess(raw, ds.shoe);
    ds.analytics.countTotal++;
    ds.analytics.responseMsSum += Date.now() - ds.phaseStartedAt;
    ds.analytics.responseCount++;
    const guess = parsed.ok ? parsed.value : null;
    const ok = guess != null && Math.abs(guess - actual) <= 1;
    if (ok) {
      ds.analytics.countCorrect++;
      this.toast('✓ Count correct!', 'success', 2500);
      Sounds.play('count');
    } else {
      const wrongLabel = parsed.ok ? fmtSignedCount(parsed.value) : (raw || '—');
      recordMistakeReviewEntry(this.save, {
        drillId: 'dealer-mode',
        category: 'count',
        context: 'Dealer shift count check',
        wrong: wrongLabel,
        correct: fmtSignedCount(actual),
        detail: parsed.ok ? `Off by ${Math.abs(parsed.value - actual)}` : 'Invalid or timed out',
      });
      this.toast(`Running count was ${actual >= 0 ? '+' : ''}${actual}`, 'info', 3000);
    }
    this.finishDealerRound();
  }

  finishDealerRound() {
    const ds = this.dealerSession;
    if (!ds) return;
    ds.roundPhase = 'between';
    ds.log = `Hand ${ds.handsPlayed}/${ds.targetHands} · Round ${ds.roundHousePL >= 0 ? '+' : ''}${ds.roundHousePL} · Bank ${ds.houseBank.toLocaleString()}`;
    this.renderDealerMode();
    this.persist();
    setTimeout(() => this.runDealerRound(), 1100);
  }

  endDealerShift(early = false) {
    this.stopDealerTimer();
    const ds = this.dealerSession;
    if (!ds) return;
    const stats = this.save.dealerMode || defaultDealerModeStats();
    stats.sessionsPlayed += 1;
    stats.totalHands += ds.handsPlayed;
    stats.totalPayoutCorrect += ds.analytics.payoutCorrect;
    stats.totalPayoutAttempts += ds.analytics.payoutTotal;
    stats.totalCountCorrect += ds.analytics.countCorrect;
    stats.totalCountAttempts += ds.analytics.countTotal;
    const payoutAcc = ds.analytics.payoutTotal
      ? Math.round(100 * ds.analytics.payoutCorrect / ds.analytics.payoutTotal) : 100;
    const countAcc = ds.analytics.countTotal
      ? Math.round(100 * ds.analytics.countCorrect / ds.analytics.countTotal) : 0;
    const dealerActionAcc = ds.analytics.dealerActionTotal
      ? Math.round(100 * ds.analytics.dealerActionCorrect / ds.analytics.dealerActionTotal) : null;
    stats.bestPayoutAccuracy = Math.max(stats.bestPayoutAccuracy, payoutAcc);
    stats.bestCountAccuracy = Math.max(stats.bestCountAccuracy, countAcc);
    const housePL = ds.houseBank - ds.startBank;
    const avgResponseMs = ds.analytics.responseCount
      ? Math.round(ds.analytics.responseMsSum / ds.analytics.responseCount) : 0;
    stats.lastSession = {
      at: Date.now(),
      hands: ds.handsPlayed,
      payoutAcc,
      countAcc,
      dealerActionAcc,
      avgResponseMs,
      housePL,
      early,
    };
    this.save.dealerMode = stats;
    recordTrainingHistorySession(this.save, 'dealer-mode', {
      attempts: ds.handsPlayed,
      accuracy: payoutAcc,
      avgError: avgResponseMs,
      meta: { housePL, countAcc, dealerActionAcc },
    });
    const reward = computeDealerShiftReward(payoutAcc, ds.handsPlayed, early, housePL, ds.eventMode);
    if (reward.chips) addChips(this.save, reward.chips);
    if (reward.gems) addGems(this.save, reward.gems);
    if (ds.eventMode && !early) {
      const prog = ensureSpecialEventProgress(this.save);
      prog.dealerShifts = (prog.dealerShifts || 0) + 1;
      prog.dealerBestAcc = Math.max(prog.dealerBestAcc || 0, payoutAcc);
      if (reward.gems) prog.gemsEarned = (prog.gemsEarned || 0) + reward.gems;
    }
    this.dealerEventActive = null;
    this.checkDailyTrainingProgress('drillSession', {
      drillId: 'dealer-mode',
      accuracy: payoutAcc,
      attempts: ds.handsPlayed,
    });
    this.checkEngagement();
    this.dealerSession = null;
    this.save.sessionActive = false;
    Sounds.play(reward.chips || reward.gems ? 'reward' : housePL >= 0 ? 'win' : 'loss');
    if (reward.chips || reward.gems) {
      const parts = [];
      if (reward.chips) parts.push(`+${reward.chips.toLocaleString()} chips`);
      if (reward.gems) parts.push(`+${reward.gems} gem`);
      this.toast(`Shift reward: ${parts.join(' · ')}`, 'level', 4500);
      lobbyTapFeedback('sparkle');
    } else if (reward.reason) {
      this.toast(early ? 'Shift ended early — no reward' : 'Finish more hands for shift rewards', 'info', 3500);
    }
    this.finishDrillWithSummary('dealer-mode', {
      payoutAcc,
      payoutCorrect: ds.analytics.payoutCorrect,
      payoutTotal: ds.analytics.payoutTotal,
      countAcc,
      dealerActionAcc,
      housePL,
      handsPlayed: ds.handsPlayed,
      avgResponseMs,
      early,
      rewardChips: reward.chips,
      rewardGems: reward.gems,
    });
  }

  renderTournamentBracketHtml(t) {
    const rounds = [[], [], []];
    t.bracket.forEach((slot, i) => {
      const r = i < 4 ? 0 : i < 6 ? 1 : 2;
      rounds[r].push(slot);
    });
    const slotHtml = (slot) => {
      const cls = [
        'tournament-slot',
        slot.isPlayer ? 'is-player' : '',
        slot.eliminated ? 'is-eliminated' : '',
        t.contenders.length === 1 && t.contenders[0] === slot.id ? 'is-winner' : '',
      ].filter(Boolean).join(' ');
      return `<div class="${cls}">
        <span class="tournament-slot-avatar">${slot.avatar}</span>
        <span class="tournament-slot-name">${slot.name}${slot.isPlayer ? ' (you)' : ''}</span>
      </div>`;
    };
    return `<div class="tournament-rounds">
      ${TOURNAMENT_ROUND_LABELS.map((label, ri) => `
        <div class="tournament-round">
          <div class="tournament-round-label">${label}</div>
          ${(rounds[ri] || []).map(slotHtml).join('')}
        </div>`).join('')}
    </div>`;
  }

  renderTournament() {
    const t = ensureTournament(this.save);
    const tier = getTournamentTier();
    const entry = document.getElementById('tournament-entry-panel');
    const bracketPanel = document.getElementById('tournament-bracket-panel');
    const matchPanel = document.getElementById('tournament-match-panel');
    const statusBar = document.getElementById('tournament-status-bar');
    const tree = document.getElementById('tournament-bracket-tree');
    const subtitle = document.getElementById('tournament-subtitle');

    if (!t.active) {
      entry?.classList.remove('hidden');
      bracketPanel?.classList.add('hidden');
      if (entry && tier) {
        const check = canEnterTournament(this.save);
        const w = getWallet(this.save);
        entry.innerHTML = `
          <div class="tournament-prize-card">
            <h3 class="font-bold text-gold text-lg">Pro Bracket — ${TOURNAMENT_BRACKET_SIZE} Players</h3>
            <p class="text-xs text-emerald-300/80 mt-1">${tier.desc}</p>
            <div class="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
              <div class="rounded-lg bg-black/25 p-2 border border-amber-600/25">
                <div class="text-gold font-bold">🥇 25K</div><div class="text-emerald-500/70">+3 💎</div>
              </div>
              <div class="rounded-lg bg-black/25 p-2 border border-white/10">
                <div class="text-amber-300 font-bold">🥈 10K</div><div class="text-emerald-500/70">+1 💎</div>
              </div>
              <div class="rounded-lg bg-black/25 p-2 border border-white/10">
                <div class="text-emerald-300 font-bold">🥉 5K</div><div class="text-emerald-500/70">Semis</div>
              </div>
            </div>
            <p class="text-[11px] text-cyan-300/80 mt-3 font-mono">
              Entry ${tier.entryFeeChips.toLocaleString()} 🪙${tier.entryFeeGems ? ` + ${tier.entryFeeGems} 💎` : ''}
              · ${TOURNAMENT_HANDS_PER_MATCH}-hand duels · ${TOURNAMENT_MATCH_CHIPS.toLocaleString()} match chips
            </p>
            <p class="text-xs text-emerald-400/70 mt-2">Balance: 🪙 ${w.chips.toLocaleString()} · 💎 ${w.gems}</p>
            ${t.pendingInvite ? `<p class="text-xs text-violet-200/90 mt-2 rounded-lg bg-violet-950/40 border border-violet-600/30 px-3 py-2">🤝 <strong>${t.pendingInvite.inviterName}</strong> challenged you — enter the same Pro bracket!</p>` : ''}
            ${!check.ok ? `<p class="text-xs text-amber-300/90 mt-2">🔒 ${check.reasons[0]}</p>` : ''}
            <div class="mt-3 grid gap-2">
              <button type="button" id="btn-tournament-start" class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-bold" ${check.ok ? '' : 'disabled'}>
                Enter Tournament
              </button>
              <button type="button" id="btn-tournament-invite" class="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm text-emerald-100">
                Invite Friend (copy link)
              </button>
            </div>
          </div>
          ${t.stats?.played ? `<p class="text-center text-xs text-emerald-500/60 mt-2">Played ${t.stats.played} · Best finish: ${t.stats.bestPlacement ? '#' + t.stats.bestPlacement : '—'}</p>` : ''}`;
        document.getElementById('btn-tournament-start')?.addEventListener('click', () => this.startTournament());
        document.getElementById('btn-tournament-invite')?.addEventListener('click', () => this.copyTournamentInvite());
      }
      if (subtitle) subtitle.textContent = '8-player single elimination — beat the bracket to claim the prize pool';
      return;
    }

    entry?.classList.add('hidden');
    bracketPanel?.classList.remove('hidden');
    if (tree) tree.innerHTML = this.renderTournamentBracketHtml(t);
    if (statusBar) {
      const roundLabel = TOURNAMENT_ROUND_LABELS[Math.min(t.round - 1, 2)] || 'Final';
      statusBar.innerHTML = `<div class="flex flex-wrap justify-between gap-2 items-center">
        <span><strong class="text-gold">${roundLabel}</strong> · ${t.contenders.length} players left</span>
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-xs text-cyan-300/80">Entry ${t.entryFee.toLocaleString()} 🪙 paid</span>
          <button type="button" id="btn-tournament-invite-active" class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] text-emerald-100">Invite Friend</button>
        </div>
      </div>`;
      document.getElementById('btn-tournament-invite-active')?.addEventListener('click', () => this.copyTournamentInvite());
    }

    const pairing = getPlayerTournamentPairing(t);
    if (matchPanel) {
      if (t.status === 'won') {
        matchPanel.innerHTML = `<div class="text-center py-4">
          <div class="text-4xl mb-2">🏆</div>
          <h3 class="font-bold text-gold text-xl">Tournament Champion!</h3>
          <p class="text-sm text-emerald-300/80 mt-1">+${TOURNAMENT_PRIZES[1].chips.toLocaleString()} chips · +${TOURNAMENT_PRIZES[1].gems} 💎</p>
          <button type="button" id="btn-tournament-done" class="mt-3 w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-bold">Collect &amp; Return</button>
        </div>`;
        document.getElementById('btn-tournament-done')?.addEventListener('click', () => this.closeTournament());
      } else if (t.status === 'eliminated') {
        const place = t.placement || '—';
        const prize = TOURNAMENT_PRIZES[place];
        matchPanel.innerHTML = `<div class="text-center py-4">
          <h3 class="font-bold text-amber-300 text-lg">Eliminated — #${place}</h3>
          ${prize ? `<p class="text-sm text-emerald-300/80 mt-1">${prize.label}: +${prize.chips.toLocaleString()} chips${prize.gems ? ` · +${prize.gems} 💎` : ''}</p>` : '<p class="text-sm text-emerald-400/60 mt-1">No prize this run</p>'}
          <button type="button" id="btn-tournament-done" class="mt-3 w-full py-3 rounded-xl bg-white/10 hover:bg-white/15">Return to Menu</button>
        </div>`;
        document.getElementById('btn-tournament-done')?.addEventListener('click', () => this.closeTournament());
      } else if (pairing) {
        const opp = pairing.opponent;
        matchPanel.innerHTML = `
          <h4 class="font-bold text-gold">Your Match</h4>
          <p class="text-sm text-emerald-200/85">vs <strong>${opp.name}</strong> — play ${TOURNAMENT_HANDS_PER_MATCH} hands. Highest net P/L wins the duel.</p>
          <p class="text-xs text-cyan-300/70 font-mono">Match bankroll: ${TOURNAMENT_MATCH_CHIPS.toLocaleString()} chips · Pro table rules</p>
          <button type="button" id="btn-tournament-play-match" class="mt-2 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold">Play Match</button>`;
        document.getElementById('btn-tournament-play-match')?.addEventListener('click', () => this.beginTournamentMatch(pairing));
      } else {
        matchPanel.innerHTML = `<p class="text-sm text-emerald-400/70 text-center py-3">Simulating other bracket matches…</p>`;
        simulateTournamentRoundAI(t);
        const next = getPlayerTournamentPairing(t);
        if (!next && t.contenders.length === 1) {
          this.finalizeTournamentChampion();
        } else {
          this.renderTournament();
        }
      }
    }
    if (subtitle) subtitle.textContent = `Round ${t.round} — ${t.contenders.length} contenders remain`;
  }

  startTournament() {
    const check = canEnterTournament(this.save);
    if (!check.ok) {
      this.toast(check.reasons[0], 'error');
      return;
    }
    const paid = payTournamentEntry(this.save);
    if (!paid.ok) {
      this.toast(paid.error, 'error');
      return;
    }
    const t = ensureTournament(this.save);
    t.active = true;
    t.round = 1;
    t.bracket = createTournamentBracket(this.save);
    t.contenders = t.bracket.map(s => s.id);
    t.playedMatches = [];
    t.results = [];
    t.playerSlotId = t.bracket.find(s => s.isPlayer)?.id || null;
    t.status = 'active';
    t.placement = null;
    t.match = null;
    t.entryFee = paid.fee;
    t.entryGems = paid.gems;
    t.pendingInvite = null;
    t.stats.played = (t.stats.played || 0) + 1;
    simulateTournamentRoundAI(t);
    this.persist();
    Sounds.play('chip');
    this.toast('Tournament started! Win your bracket match to advance.', 'level', 4000);
    this.renderTournament();
  }

  beginTournamentMatch(pairing) {
    const t = ensureTournament(this.save);
    const tier = getTournamentTier();
    if (!tier || !pairing) return;
    this._tournamentSavedChips = this.chips;
    this._tournamentSavedGems = this.gems;
    t.match = {
      key: pairing.key,
      opponentId: pairing.opponent.id,
      opponentName: pairing.opponent.name,
      opponentTarget: rollTournamentOpponentTarget(pairing.opponent, t.round),
      handsPlayed: 0,
      playerNetPL: 0,
    };
    this.save.settings.practiceMode = false;
    this.save.sessionMode = 'tournament';
    this.save.sessionDrill = null;
    this.save.sessionTableTier = TOURNAMENT_TIER_ID;
    this.save.settings.minBet = tier.minBet;
    this.save.settings.unitSize = tier.unitSize;
    this.applyTheme(tier.theme);
    this.bankroll = TOURNAMENT_MATCH_CHIPS;
    this.save.sessionActive = true;
    this.save.sessionHands = 0;
    this.save.sessionNetPL = 0;
    this.session = {
      start: TOURNAMENT_MATCH_CHIPS,
      wagered: 0, netPL: 0, hands: 0,
      insTaken: 0, insWon: 0, decisions: 0, decisionsCorrect: 0,
      countQuizCorrect: 0, countQuizTotal: 0, betStreak: 0,
      tournamentMatch: true,
    };
    this.shoe = new Shoe(this.settings.numDecks);
    this.counter = this.createCounter();
    this.help = new HelpSystem(this.stats.helpLevel, 'normal');
    this.initializeCounterFromBurnedCards();
    this.persist();
    Sounds.play('chip');
    this.toast(`Duel vs ${pairing.opponent.name} — beat ${t.match.opponentTarget} net P/L in ${TOURNAMENT_HANDS_PER_MATCH} hands`, 'info', 4500);
    this.beginBetPhase();
  }

  resolveTournamentMatch() {
    const t = ensureTournament(this.save);
    const m = t.match;
    if (!m) return;
    const playerScore = this.session?.netPL ?? m.playerNetPL ?? 0;
    const won = playerScore > m.opponentTarget;
    if (this._tournamentSavedChips != null) {
      this.chips = this._tournamentSavedChips;
      this.save.bankroll = this._tournamentSavedChips;
    }
    t.playedMatches.push(m.key);
    const pairing = getPlayerTournamentPairing(t);
    const playerId = t.playerSlotId;
    const oppId = m.opponentId;
    const winnerId = won ? playerId : oppId;
    const loserId = won ? oppId : playerId;
    t.results.push({ round: t.round, winnerId, loserId, playerScore, opponentTarget: m.opponentTarget, simulated: false });
    const loser = getBracketSlot(t, loserId);
    if (loser) loser.eliminated = true;
    t.contenders = t.contenders.filter(id => id !== loserId);
    t.match = null;
    this.save.sessionActive = false;
    this.save.sessionMode = null;
    this.save.sessionTableTier = null;
    this.session = null;

    if (!won) {
      t.status = 'eliminated';
      t.placement = tournamentPlacementForRound(t.round, false);
      t.active = false;
      if (t.placement && TOURNAMENT_PRIZES[t.placement]) {
        const prize = awardTournamentPrize(this.save, t.placement);
        this.toast(`Eliminated in ${TOURNAMENT_ROUND_LABELS[t.round - 1] || 'Final'} — ${prize.label}`, 'info', 5000);
      } else {
        this.toast(`Eliminated — scored ${playerScore} vs ${m.opponentTarget}`, 'info', 4500);
      }
      if (!t.stats.bestPlacement || t.placement < t.stats.bestPlacement) t.stats.bestPlacement = t.placement;
      this.persist();
      this.phase = 'tournament';
      this.render();
      return;
    }

    this.toast(`Match won! ${playerScore} vs ${m.opponentTarget} — advancing`, 'win', 4000);
    t.stats.won = (t.stats.won || 0) + 1;

    if (t.contenders.length === 1) {
      this.finalizeTournamentChampion();
      return;
    }

    if (t.contenders.length <= 4 && t.round < 2) t.round = 2;
    if (t.contenders.length <= 2 && t.round < 3) t.round = 3;
    simulateTournamentRoundAI(t);
    if (t.contenders.length === 1) {
      this.finalizeTournamentChampion();
      return;
    }
    this.persist();
    this.phase = 'tournament';
    this.render();
  }

  finalizeTournamentChampion() {
    const t = ensureTournament(this.save);
    const champId = t.contenders[0];
    if (champId === t.playerSlotId) {
      t.status = 'won';
      t.placement = 1;
      t.active = false;
      const prize = awardTournamentPrize(this.save, 1);
      t.stats.won = (t.stats.won || 0) + 1;
      if (!t.stats.bestPlacement || 1 < t.stats.bestPlacement) t.stats.bestPlacement = 1;
      this.persist();
      Sounds.play('bigwin');
      this.toast(`${prize.label}! +${prize.chips.toLocaleString()} chips · +${prize.gems} 💎`, 'level', 6000);
      this.phase = 'tournament';
      this.render();
    } else {
      t.status = 'eliminated';
      t.placement = 2;
      t.active = false;
      const prize = awardTournamentPrize(this.save, 2);
      if (!t.stats.bestPlacement || 2 < t.stats.bestPlacement) t.stats.bestPlacement = 2;
      this.persist();
      this.toast(`Runner-up — ${getBracketSlot(t, champId)?.name || 'Champion'} wins. ${prize.label}`, 'info', 5000);
      this.phase = 'tournament';
      this.render();
    }
  }

  closeTournament() {
    const t = ensureTournament(this.save);
    t.active = false;
    t.status = 'idle';
    t.match = null;
    document.getElementById('tournament-entry-panel')?.classList.remove('hidden');
    this.persist();
    this.goMenu();
  }

  renderTableLobby() {
    const w = getWallet(this.save);
    const st = this.stats;
    const hint = document.getElementById('lobby-currency-hint');
    if (hint) {
      hint.innerHTML = `Balance: <strong class="text-emerald-300">🪙 ${w.chips.toLocaleString()}</strong> chips · `
        + `<strong class="text-violet-200">💎 ${w.gems}</strong> gems · `
        + `Rank <strong class="text-gold">${RANK_NAMES[st.rank]}</strong> · Help Level ${st.helpLevel}`;
    }
    const list = document.getElementById('table-tier-list');
    if (!list) return;
    list.innerHTML = TABLE_TIERS.map(tier => {
      const check = canJoinTable(this.save, tier);
      const locked = !check.ok;
      const req = [
        `${tier.entryFeeChips.toLocaleString()} chips entry`,
        tier.entryFeeGems ? `${tier.entryFeeGems} 💎` : null,
        `Min ${tier.minChips.toLocaleString()} chips`,
        tier.minHelpLevel ? `Help Level ${tier.minHelpLevel}+` : null,
        tier.minRank ? `${RANK_NAMES[tier.minRank]}+` : null,
      ].filter(Boolean).join(' · ');
      const pot = tier.entryFeeChips * 2;
      const win = calcTableWinPayout(tier.entryFeeChips);
      return `<button type="button" data-table-tier="${tier.id}" ${locked ? 'disabled' : ''}
        class="mode-card w-full text-left p-4 rounded-xl border transition ${locked
          ? 'bg-white/5 border-white/5 opacity-60 cursor-not-allowed'
          : 'bg-white/10 hover:bg-white/15 border-white/10'}">
        <div class="flex gap-3 items-start">
          <span class="text-3xl">${tier.icon}</span>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-gold text-lg">${tier.name}</div>
            <div class="text-xs text-emerald-300/80 mt-0.5">${tier.desc}</div>
            <div class="text-[11px] text-cyan-300/80 mt-1 font-mono">Entry ${tier.entryFeeChips.toLocaleString()} → pot ${pot.toLocaleString()} · win ${win.toLocaleString()} (1.8×)</div>
            <div class="text-[10px] text-emerald-500/60 mt-1">${req}</div>
            ${locked ? `<div class="text-[10px] text-amber-300/90 mt-1">🔒 ${check.reasons[0]}</div>` : ''}
          </div>
        </div>
      </button>`;
    }).join('');
  }

  joinTable(tierId) {
    const tier = getTableTier(tierId);
    if (!tier) return;
    const paid = payTableEntry(this.save, tier);
    if (!paid.ok) {
      this.toast(paid.error || 'Cannot join table', 'error');
      this.renderTableLobby();
      return;
    }
    this.save.settings.practiceMode = false;
    this.save.sessionMode = 'tables';
    this.save.sessionDrill = null;
    this.save.sessionTableTier = tierId;
    this.save.settings.minBet = tier.minBet;
    this.save.settings.unitSize = tier.unitSize;
    this.applyTheme(tier.theme);
    this.tableAiSeats = null;
    this.save.sessionActive = true;
    this.save.sessionHands = 0;
    this.save.sessionNetPL = 0;
    this.bankroll = this.chips;
    this.session = {
      start: this.chips,
      wagered: 0,
      netPL: 0,
      hands: 0,
      insTaken: 0,
      insWon: 0,
      decisions: 0,
      decisionsCorrect: 0,
      countQuizCorrect: 0,
      countQuizTotal: 0,
      betStreak: 0,
      tableTierId: tierId,
      tableEntryFee: tier.entryFeeChips,
      tableEntryGems: tier.entryFeeGems,
      tablePot: paid.pot,
      tableWinPayout: paid.winPayout,
      tableMaxBet: tier.maxBet,
    };
    this.shoe = new Shoe(this.settings.numDecks);
    this.counter = this.createCounter();
    this.help = new HelpSystem(this.stats.helpLevel, 'normal');
    this.initializeCounterFromBurnedCards();
    this.persist();
    Sounds.play('chip');
    this.toast(
      `Seated at ${tier.name} — entry ${tier.entryFeeChips.toLocaleString()} chips. Win the session for ${paid.winPayout.toLocaleString()} chips (1.8× pot)!`,
      'info',
      4500,
    );
    this.beginBetPhase();
  }

  settleTableSessionIfNeeded() {
    const isTable = this.save.sessionMode === 'tables' || this.save.sessionMode === 'special-event';
    if (!isTable || !this.session?.tableTierId) return null;
    const result = settleTableSession(this.save, this.session);
    if (!result) return null;
    const ev = this.session.specialEventId
      ? SPECIAL_EVENTS.find(e => e.id === this.session.specialEventId) : null;
    const tier = getTableTier(this.session.tableTierId);
    const label = ev?.name || tier?.name || 'Table';
    if (this.save.sessionMode === 'special-event' && result.won) {
      ensureSpecialEventProgress(this.save);
      this.save.specialEvent.wins += 1;
      if (result.bonusGems) this.save.specialEvent.gemsEarned += result.bonusGems;
    }
    if (result.won) {
      Sounds.play('bigwin');
      const mult = result.multiplier || TABLE_WIN_MULTIPLIER;
      const gemPart = result.bonusGems ? ` · +${result.bonusGems} 💎` : '';
      this.toast(
        `${label} won! +${result.payout.toLocaleString()} chips (${mult}× entry, ${result.rake} rake)${gemPart} · session P/L +${result.netPL}`,
        'success',
        5500,
      );
    } else {
      this.toast(
        `${label} lost — entry ${result.entry.toLocaleString()} chips forfeited · session P/L ${result.netPL}`,
        'info',
        4500,
      );
    }
    this.save.sessionTableTier = null;
    return result;
  }

  openClubs() {
    ensurePlayerId(this.save);
    const club = getPlayerClub(this.save);
    if (club?._pendingPlayerPayout) {
      const p = club._pendingPlayerPayout;
      this.toast(
        `${p.label}! +${p.chips.toLocaleString()} chips${p.gems ? ` · +${p.gems} 💎` : ''} — weekly championship payout`,
        'level',
        6000,
      );
      delete club._pendingPlayerPayout;
      ClubsRegistry.upsert(club);
      this.persist();
      Sounds.play('level');
    }
    this.clubsView = this.save.club?.clubId ? 'hub' : 'main';
    this.clubSearchQuery = this.clubSearchQuery || '';
    this.phase = 'clubs';
    this.render();
  }

  trackClubWeekly(type, data = {}) {
    const result = recordClubWeeklyActivity(this.save, type, data);
    if (!result) return null;
    for (const r of result.rewards || []) {
      const gemPart = r.gems ? ` + ${r.gems} 💎` : '';
      this.toast(`Crew milestone! +${r.chips} chips${gemPart} (${r.label})`, 'success', 4500);
    }
    return result;
  }

  showClubCreateForm() {
    this.clubsView = 'create';
    const err = document.getElementById('club-create-error');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    this.renderClubs();
  }

  hideClubCreateForm() {
    this.clubsView = 'main';
    this.renderClubs();
  }

  showClubEditForm() {
    const club = getPlayerClub(this.save);
    if (!club || !hasClubPermission(this.save.club?.role, 'editClub')) {
      this.toast('You cannot edit crew info', 'error');
      return;
    }
    this.clubsView = 'edit';
    const err = document.getElementById('club-edit-error');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    this.renderClubs();
    const nameEl = document.getElementById('club-edit-name');
    const descEl = document.getElementById('club-edit-desc');
    const goalEl = document.getElementById('club-edit-goal');
    if (nameEl) nameEl.value = club.name;
    if (descEl) descEl.value = club.description || '';
    if (goalEl) goalEl.value = club.weekly?.challenge?.text || club.goal?.text || '';
    const targetEl = document.getElementById('club-edit-weekly-target');
    if (targetEl) targetEl.value = club.weekly?.challenge?.targetPoints || 500;
    const vis = club.visibility === 'private' ? 'private' : 'public';
    document.querySelectorAll('input[name="club-edit-visibility"]').forEach(r => {
      r.checked = r.value === vis;
    });
  }

  hideClubEditForm() {
    this.clubsView = this.save.club?.clubId ? 'hub' : 'main';
    this.renderClubs();
  }

  submitEditClub() {
    const name = document.getElementById('club-edit-name')?.value;
    const description = document.getElementById('club-edit-desc')?.value;
    const goalText = document.getElementById('club-edit-goal')?.value;
    const targetPoints = document.getElementById('club-edit-weekly-target')?.value;
    const visEl = document.querySelector('input[name="club-edit-visibility"]:checked');
    const info = updateClubInfo(this.save, { name, description, visibility: visEl?.value });
    const errEl = document.getElementById('club-edit-error');
    if (!info.ok) {
      if (errEl) { errEl.textContent = info.error; errEl.classList.remove('hidden'); }
      this.toast(info.error, 'error');
      return;
    }
    const weekly = setClubWeeklyChallenge(this.save, { text: goalText, targetPoints });
    if (!weekly.ok) {
      if (errEl) { errEl.textContent = weekly.error; errEl.classList.remove('hidden'); }
      this.toast(weekly.error, 'error');
      return;
    }
    this.persist();
    this.toast('Crew & weekly challenge updated', 'success');
    this.clubsView = 'hub';
    if (errEl) errEl.classList.add('hidden');
    this.render();
  }

  submitClubChat() {
    const input = document.getElementById('club-chat-input');
    const result = postClubChatMessage(this.save, input?.value);
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    if (input) input.value = '';
    this.renderClubHub();
  }

  submitClubAnnouncement() {
    const input = document.getElementById('club-announcement-input');
    const result = postClubAnnouncement(this.save, input?.value);
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    if (input) input.value = '';
    this.toast('Announcement posted', 'success');
    this.renderClubHub();
  }

  reactClubChat(messageId, emoji) {
    const result = reactClubChatMessage(this.save, messageId, emoji);
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    this.renderClubHubChat(getPlayerClub(this.save));
  }

  clubManageAction(action, memberId) {
    const handlers = {
      promote: () => promoteClubMember(this.save, memberId),
      demote: () => demoteClubMember(this.save, memberId),
      kick: () => kickClubMember(this.save, memberId),
      transfer: () => transferClubLeadership(this.save, memberId),
    };
    const fn = handlers[action];
    if (!fn) return;
    if (action === 'kick' && !confirm('Remove this member from the crew?')) return;
    if (action === 'transfer' && !confirm('Transfer leadership to this member? You will become Co-Leader.')) return;
    const result = fn();
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    this.persist();
    const msgs = {
      promote: `Promoted to ${clubRoleLabel(result.newRole)}`,
      demote: `Demoted to ${clubRoleLabel(result.newRole)}`,
      kick: `Removed ${result.kicked?.displayName || 'member'}`,
      transfer: `${result.newLeader?.displayName || 'Member'} is now Leader`,
    };
    this.toast(msgs[action], 'success', 3000);
    this.renderClubHub();
  }

  submitCreateClub() {
    const name = document.getElementById('club-create-name')?.value || '';
    const description = document.getElementById('club-create-desc')?.value || '';
    const visEl = document.querySelector('input[name="club-visibility"]:checked');
    const visibility = visEl?.value || 'public';
    const result = createClub(this.save, { name, description, visibility });
    const errEl = document.getElementById('club-create-error');
    if (!result.ok) {
      if (errEl) { errEl.textContent = result.error; errEl.classList.remove('hidden'); }
      this.toast(result.error, 'error');
      return;
    }
    this.persist();
    Sounds.play('level');
    this.toast(`Crew "${result.club.name}" created!`, 'success', 3500);
    this.clubsView = 'hub';
    const nameInput = document.getElementById('club-create-name');
    const descInput = document.getElementById('club-create-desc');
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (errEl) errEl.classList.add('hidden');
    this.render();
  }

  joinClubById(clubId) {
    const result = joinClub(this.save, clubId);
    if (!result.ok) {
      this.toast(result.error, 'error');
      this.renderClubs();
      return;
    }
    this.persist();
    Sounds.play('chip');
    this.toast(`Joined ${result.club.name}!`, 'success', 3000);
    this.clubsView = 'hub';
    this.renderClubs();
  }

  leaveCurrentClub() {
    const club = getPlayerClub(this.save);
    const name = club?.name || 'crew';
    const result = leaveClub(this.save);
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    this.persist();
    this.toast(`Left ${name}`, 'info', 2500);
    this.clubsView = 'main';
    this.renderClubs();
  }

  setClubSearchQuery(query) {
    this.clubSearchQuery = query;
    this.renderClubsBrowse();
  }

  renderClubMemberList(club, { showWeekly = false } = {}) {
    const actorRole = this.save.club?.role;
    const members = showWeekly ? getClubWeeklyLeaderboard(club) : sortClubMembers(club.members).map(m => ({
      ...m, weekly: getMemberWeeklyScore(club, m.id),
    }));
    if (!members.length) {
      return '<p class="text-sm text-emerald-400/60 text-center py-2">No members yet.</p>';
    }
    return `<div class="space-y-2 max-h-[44vh] overflow-y-auto pr-1">${members.map(m => {
      const rankName = RANK_NAMES[m.rank] || RANK_NAMES[0];
      const isYou = m.id === this.save.playerId;
      const w = m.weekly || defaultMemberWeeklyScore();
      const showPromote = !isYou && canPromoteMember(actorRole, m.role);
      const showDemote = !isYou && canDemoteMember(actorRole, m.role);
      const showKick = !isYou && canKickMember(actorRole, m.role);
      const showTransfer = !isYou && hasClubPermission(actorRole, 'transferLeadership');
      const actions = (showPromote || showDemote || showKick || showTransfer)
        ? `<div class="flex flex-wrap gap-1 shrink-0 justify-end">
            ${showPromote ? `<button type="button" data-club-promote="${m.id}" title="Promote" class="px-2 py-1 rounded text-[10px] bg-emerald-900/50 border border-emerald-600/30 text-emerald-200">▲</button>` : ''}
            ${showDemote ? `<button type="button" data-club-demote="${m.id}" title="Demote" class="px-2 py-1 rounded text-[10px] bg-amber-900/40 border border-amber-600/30 text-amber-200">▼</button>` : ''}
            ${showKick ? `<button type="button" data-club-kick="${m.id}" title="Kick" class="px-2 py-1 rounded text-[10px] bg-red-950/50 border border-red-700/30 text-red-200">✕</button>` : ''}
            ${showTransfer ? `<button type="button" data-club-transfer="${m.id}" title="Transfer leadership" class="px-2 py-1 rounded text-[10px] bg-violet-950/50 border border-violet-600/30 text-violet-200">👑</button>` : ''}
          </div>` : '';
      const statsLine = showWeekly
        ? `${w.points} pts · ${w.hands} hands · count ${w.countCorrect}/${w.countTotal || 0}`
        : `${rankName} · Help Level ${m.helpLevel}`;
      return `<div class="flex items-center justify-between gap-2 p-3 rounded-lg bg-black/25 border border-white/5">
        <div class="min-w-0 flex-1">
          <div class="font-medium text-emerald-100 truncate">${m.displayName}${isYou ? ' <span class="text-cyan-300/80">(you)</span>' : ''}</div>
          <div class="text-[11px] text-emerald-400/70">${clubRoleLabel(m.role)} · ${statsLine}</div>
        </div>
        ${actions}
      </div>`;
    }).join('')}</div>`;
  }

  renderClubHubHeader(club) {
    const el = document.getElementById('club-hub-header');
    if (!el) return;
    const myRole = normalizeClubRole(this.save.club.role);
    const canEdit = hasClubPermission(myRole, 'editClub');
    const visLabel = club.visibility === 'private' ? '🔒 Private' : '🌐 Public';
    el.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="text-[10px] uppercase tracking-wider text-amber-400/80">Crew Hub</p>
          <h3 class="font-bold text-gold text-xl">${club.name}</h3>
          <p class="text-xs text-emerald-300/80 mt-0.5">${club.description || 'No description'}</p>
        </div>
        <div class="text-right text-xs space-y-0.5">
          <div class="text-cyan-300/90">${visLabel}</div>
          <div class="text-emerald-400/80">${clubRoleLabel(myRole)}</div>
          <div class="font-mono text-cyan-300/80">${clubMemberCount(club)}/${CLUB_MAX_MEMBERS}</div>
        </div>
      </div>
      ${canEdit ? `<button id="btn-club-edit-open" type="button" class="w-full mt-2 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-600/30 text-sm text-amber-200">✎ Edit Crew · Weekly Challenge · Manage</button>` : ''}`;
  }

  renderClubHubWeekly(club) {
    const el = document.getElementById('club-hub-weekly');
    if (!el) return;
    ensureClubHubData(club);
    const w = club.weekly;
    const pct = Math.min(100, Math.round((w.crewTotal / (w.challenge.targetPoints || 500)) * 100));
    const nextMs = CLUB_WEEKLY_MILESTONES.find(ms => !w.milestonesAwarded.includes(String(ms.at)));
    el.innerHTML = `
      <div class="flex justify-between items-center gap-2 mb-2">
        <h4 class="text-sm font-semibold text-amber-300/90">🏆 Weekly Crew Championship</h4>
        <span class="text-[10px] font-mono text-cyan-300/80">${w.weekKey}</span>
      </div>
      <p class="text-sm text-emerald-100 mb-2">${w.challenge.text || 'Earn crew points together'}</p>
      <div class="flex justify-between text-xs text-emerald-400/80 mb-1">
        <span>${w.crewTotal.toLocaleString()} / ${(w.challenge.targetPoints || 500).toLocaleString()} crew pts</span>
        <span>${pct}%</span>
      </div>
      <div class="h-2.5 bg-black/40 rounded-full overflow-hidden mb-2">
        <div class="h-full bg-gradient-to-r from-cyan-600 to-emerald-500 rounded-full transition-all" style="width:${pct}%"></div>
      </div>
      <div class="text-[10px] text-emerald-500/70 space-y-0.5">
        <div>+${CLUB_WEEKLY_POINT_RULES.hand} pts/hand · +${CLUB_WEEKLY_POINT_RULES.handWin} win bonus · +${CLUB_WEEKLY_POINT_RULES.countCorrect} count quiz · +${CLUB_WEEKLY_POINT_RULES.trainingAccuracyMult}× training accuracy</div>
        ${nextMs ? `<div>Next milestone: ${nextMs.label} → +${nextMs.chips} chips${nextMs.gems ? ` + ${nextMs.gems} gem` : ''}</div>` : '<div>All milestones reached this week! 🎉</div>'}
      </div>`;
  }

  renderClubHubAnnouncements(club) {
    const el = document.getElementById('club-hub-announcements');
    if (!el) return;
    ensureClubHubData(club);
    const myRole = normalizeClubRole(this.save.club.role);
    const canPost = hasClubPermission(myRole, 'setGoals');
    const anns = club.hub.announcements || [];
    const list = anns.length
      ? anns.map(a => `<div class="p-2.5 rounded-lg bg-violet-950/25 border border-violet-700/20 text-sm">
          <div class="text-emerald-100">${a.text}</div>
          <div class="text-[10px] text-violet-300/60 mt-1">${a.authorName} · ${formatClubChatTime(a.ts)}</div>
        </div>`).join('')
      : '<p class="text-xs text-emerald-500/60 text-center py-2">No announcements yet.</p>';
    el.innerHTML = `
      <h4 class="text-sm font-semibold text-violet-200/90 mb-2">📢 Announcements</h4>
      <div class="space-y-2 mb-2 max-h-28 overflow-y-auto">${list}</div>
      ${canPost ? `<div class="flex gap-2">
        <input id="club-announcement-input" type="text" maxlength="${CLUB_ANNOUNCEMENT_MAX}" placeholder="Post announcement…"
          class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm" />
        <button id="btn-club-announcement-post" type="button" class="px-3 py-2 rounded-lg bg-violet-900/50 border border-violet-600/40 text-violet-200 text-sm shrink-0">Post</button>
      </div>` : ''}`;
  }

  renderClubHubLeaderboard(club) {
    const el = document.getElementById('club-hub-leaderboard');
    if (!el) return;
    const board = getClubWeeklyLeaderboard(club);
    const medals = ['🥇', '🥈', '🥉'];
    const rows = board.map((m, i) => {
      const medal = i < 3 ? medals[i] : `${i + 1}.`;
      const isYou = m.id === this.save.playerId;
      const w = m.weekly;
      const countAcc = w.countTotal ? Math.round((w.countCorrect / w.countTotal) * 100) : 0;
      return `<div class="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-lg w-7 text-center shrink-0">${medal}</span>
          <div class="min-w-0">
            <div class="font-medium text-emerald-100 truncate text-sm">${m.displayName}${isYou ? ' <span class="text-cyan-300/70">(you)</span>' : ''}</div>
            <div class="text-[10px] text-emerald-500/70">${clubRoleLabel(m.role)} · ${w.hands} hands · count ${countAcc}%</div>
          </div>
        </div>
        <div class="font-mono font-bold text-amber-300 text-sm shrink-0">${w.points} pts</div>
      </div>`;
    }).join('');
    el.innerHTML = `
      <h4 class="text-sm font-semibold text-emerald-300/90 mb-2">📊 Weekly Leaderboard</h4>
      <div class="max-h-48 overflow-y-auto">${rows || '<p class="text-xs text-center text-emerald-500/60 py-3">Play hands & drills to earn points!</p>'}</div>`;
  }

  renderClubHubChat(club) {
    const el = document.getElementById('club-hub-chat');
    if (!el) return;
    ensureClubHubData(club);
    const messages = [...(club.hub.chat || [])].slice(-25);
    const chatHtml = messages.length
      ? messages.map(m => {
        const isYou = m.authorId === this.save.playerId;
        const reactionBtns = CLUB_CHAT_REACTIONS.map(emoji => {
          const count = (m.reactions?.[emoji] || []).length;
          const active = (m.reactions?.[emoji] || []).includes(this.save.playerId);
          return `<button type="button" data-club-react="${m.id}" data-club-emoji="${emoji}"
            class="px-1.5 py-0.5 rounded text-[10px] border ${active ? 'bg-cyan-900/50 border-cyan-600/40' : 'bg-black/20 border-white/10'}">${emoji}${count ? ` ${count}` : ''}</button>`;
        }).join('');
        return `<div class="p-2.5 rounded-lg ${isYou ? 'bg-cyan-950/30 border border-cyan-800/25' : 'bg-black/25 border border-white/5'}">
          <div class="flex justify-between gap-2 text-[10px] text-emerald-500/70 mb-0.5">
            <span class="font-medium text-emerald-200/90">${m.authorName}${isYou ? ' (you)' : ''}</span>
            <span>${formatClubChatTime(m.ts)}</span>
          </div>
          <div class="text-sm text-emerald-100">${m.text}</div>
          <div class="flex flex-wrap gap-1 mt-1.5">${reactionBtns}</div>
        </div>`;
      }).join('')
      : '<p class="text-xs text-emerald-500/60 text-center py-3">Start the conversation — say hi to your crew!</p>';
    el.innerHTML = `
      <h4 class="text-sm font-semibold text-emerald-300/90 mb-2">💬 Crew Chat</h4>
      <div id="club-chat-messages" class="space-y-2 max-h-52 overflow-y-auto mb-2 pr-1">${chatHtml}</div>
      <div class="flex gap-2">
        <input id="club-chat-input" type="text" maxlength="${CLUB_CHAT_MSG_MAX}" placeholder="Message your crew…"
          class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm" />
        <button id="btn-club-chat-send" type="button" class="px-3 py-2 rounded-lg bg-emerald-800/50 border border-emerald-600/40 text-emerald-200 text-sm shrink-0">Send</button>
      </div>`;
    const box = document.getElementById('club-chat-messages');
    if (box) box.scrollTop = box.scrollHeight;
  }

  renderClubHubMembers(club) {
    const el = document.getElementById('club-hub-members');
    if (!el) return;
    el.innerHTML = `
      <h4 class="text-sm font-semibold text-amber-300/90 mb-2">👥 Members &amp; Leader Tools</h4>
      ${this.renderClubMemberList(club, { showWeekly: true })}`;
  }

  renderClubHubInvite(club) {
    const el = document.getElementById('club-hub-invite');
    if (!el) return;
    ensureClubInviteCode(club);
    const myRole = normalizeClubRole(this.save.club.role);
    const canRegen = hasClubPermission(myRole, 'editClub');
    const visNote = club.visibility === 'private'
      ? 'Private crew — share this code to invite counters'
      : 'Public crew — invite code works alongside search';
    el.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-sm font-semibold text-violet-200/90">🔑 Crew Invite Code</h4>
        <span class="font-mono text-lg tracking-widest text-gold">${club.inviteCode}</span>
      </div>
      <p class="text-[10px] text-emerald-500/70">${visNote}</p>
      <div class="flex gap-2 mt-2">
        <button type="button" id="btn-club-invite-copy" class="flex-1 py-2 rounded-lg bg-violet-950/50 border border-violet-600/40 text-violet-100 text-sm">Copy Code</button>
        ${canRegen ? '<button type="button" id="btn-club-invite-regen" class="flex-1 py-2 rounded-lg bg-white/10 border border-white/10 text-emerald-200 text-sm">Regenerate</button>' : ''}
      </div>`;
    document.getElementById('btn-club-invite-copy')?.addEventListener('click', () => this.copyClubInviteCode());
    document.getElementById('btn-club-invite-regen')?.addEventListener('click', () => this.regenerateClubInviteAction());
  }

  renderClubHubBankroll(club) {
    const el = document.getElementById('club-hub-bankroll');
    if (!el) return;
    ensureClubBankroll(club);
    const bank = club.bankroll;
    const myRole = normalizeClubRole(this.save.club.role);
    const canDistribute = hasClubPermission(myRole, 'editClub');
    const recent = (bank.log || []).slice(0, 4).map(entry => {
      if (entry.type === 'contribute') {
        return `<div class="text-[10px] text-emerald-500/70">+${entry.chips || 0}🪙 from ${entry.memberName}</div>`;
      }
      if (entry.type === 'distribute') {
        return `<div class="text-[10px] text-emerald-500/70">→ ${entry.targetName}: ${entry.chips || 0}🪙</div>`;
      }
      if (entry.type === 'weekly_payout') {
        return `<div class="text-[10px] text-amber-400/80">${entry.rank}${entry.rank === 1 ? 'st' : entry.rank === 2 ? 'nd' : 'rd'} payout: ${entry.chips}🪙</div>`;
      }
      return '';
    }).join('');
    const distributeMembers = canDistribute
      ? (club.members || []).filter(m => m.id !== this.save.playerId).slice(0, 5)
      : [];
    el.innerHTML = `
      <div class="flex justify-between items-center gap-2 mb-2">
        <h4 class="text-sm font-semibold text-amber-300/90">🏦 Shared Crew Bankroll</h4>
        <div class="font-mono text-sm text-emerald-200">🪙 ${bank.chips.toLocaleString()} · 💎 ${bank.gems}</div>
      </div>
      <p class="text-[10px] text-emerald-500/70 mb-2">Pool chips for weekly top-3 payouts. All members can contribute.</p>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input id="club-bankroll-contribute-chips" type="number" min="${CLUB_BANKROLL_MIN_CONTRIBUTE}" step="10" placeholder="Chips"
          class="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono" />
        <input id="club-bankroll-contribute-gems" type="number" min="0" max="99" step="1" placeholder="Gems (opt)"
          class="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono" />
      </div>
      <button type="button" id="btn-club-bankroll-contribute" class="w-full py-2.5 rounded-xl bg-amber-950/50 border border-amber-600/40 text-amber-100 text-sm font-semibold mb-2">Contribute to Crew Pool</button>
      ${canDistribute && distributeMembers.length ? `
        <div class="border-t border-white/10 pt-2 mt-2 space-y-2">
          <p class="text-[10px] uppercase tracking-wider text-emerald-400/70">Leader distribute</p>
          <div class="grid grid-cols-2 gap-2">
            <input id="club-bankroll-distribute-chips" type="number" min="10" step="10" placeholder="Chips"
              class="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono" />
            <select id="club-bankroll-distribute-target" class="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm">
              ${distributeMembers.map(m => `<option value="${m.id}">${m.displayName}</option>`).join('')}
            </select>
          </div>
          <button type="button" id="btn-club-bankroll-distribute" class="w-full py-2 rounded-xl bg-white/10 border border-white/10 text-emerald-200 text-sm">Distribute Chips</button>
        </div>` : ''}
      ${recent ? `<div class="mt-2 pt-2 border-t border-white/5 space-y-0.5">${recent}</div>` : ''}`;
    document.getElementById('btn-club-bankroll-contribute')?.addEventListener('click', () => this.contributeClubBankrollAction());
    document.getElementById('btn-club-bankroll-distribute')?.addEventListener('click', () => {
      const targetId = document.getElementById('club-bankroll-distribute-target')?.value;
      if (targetId) this.distributeClubBankrollAction(targetId);
    });
  }

  renderClubHubWeeklyPayouts(club) {
    const el = document.getElementById('club-hub-weekly-payouts');
    if (!el) return;
    const history = club.weeklyHistory || [];
    const last = history[0];
    const payoutRows = CLUB_WEEKLY_TOP3_PAYOUTS.map(t => `
      <div class="text-center p-2 rounded-lg bg-black/20 border border-white/10 text-xs">
        <div>${t.label}</div>
        <div class="font-mono text-emerald-200">${t.chips}🪙${t.gems ? ` · ${t.gems}💎` : ''}</div>
      </div>`).join('');
    const lastHtml = last?.payouts?.length
      ? last.payouts.map(p => `<div class="text-[10px] text-emerald-400/80">${p.label || `#${p.rank}`}: ${p.displayName} — ${p.points} pts → ${p.chips}🪙</div>`).join('')
      : '<div class="text-[10px] text-emerald-500/60">No prior week payouts yet — rollover pays top 3 from crew bankroll (+ house top-up)</div>';
    el.innerHTML = `
      <h4 class="text-sm font-semibold text-emerald-300/90 mb-2">🏅 Weekly Top-3 Payouts</h4>
      <div class="grid grid-cols-3 gap-2 mb-2">${payoutRows}</div>
      <p class="text-[10px] text-emerald-500/70 mb-1">Paid automatically at week rollover (Monday UTC). Crew bankroll funds payouts first; house covers shortfall.</p>
      <div class="rounded-lg bg-emerald-950/30 border border-emerald-800/25 p-2 space-y-0.5">
        <div class="text-[10px] uppercase tracking-wider text-cyan-400/70">${last ? `Last week (${last.weekKey})` : 'Payout history'}</div>
        ${lastHtml}
      </div>`;
  }

  renderClubHub() {
    const club = getPlayerClub(this.save);
    if (!club) return;
    this.renderClubHubHeader(club);
    this.renderClubHubInvite(club);
    this.renderClubHubBankroll(club);
    this.renderClubHubWeekly(club);
    this.renderClubHubWeeklyPayouts(club);
    this.renderClubHubAnnouncements(club);
    this.renderClubHubLeaderboard(club);
    this.renderClubHubChat(club);
    this.renderClubHubMembers(club);
  }

  renderClubsBrowse() {
    const panel = document.getElementById('clubs-browse-panel');
    if (!panel) return;
    if (this.save.club?.clubId) {
      panel.innerHTML = '';
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    const results = searchClubs(this.clubSearchQuery);
    const cards = results.length ? results.map(club => {
      const count = clubMemberCount(club);
      const full = isClubFull(club);
      return `<button type="button" data-join-club="${club.id}" ${full ? 'disabled' : ''}
        class="mode-card w-full text-left p-4 rounded-xl border transition ${full
          ? 'bg-white/5 border-white/5 opacity-60 cursor-not-allowed'
          : 'bg-white/10 hover:bg-white/15 border-white/10'}">
        <div class="flex justify-between gap-2 items-start">
          <div class="min-w-0 flex-1">
            <div class="font-bold text-gold">${club.name}</div>
            <div class="text-xs text-emerald-300/80 mt-0.5">${club.description || 'No description'}</div>
            <div class="text-[10px] text-cyan-300/70 mt-1 font-mono">${count}/${CLUB_MAX_MEMBERS} members · Public</div>
          </div>
          <span class="text-xs px-2 py-1 rounded bg-emerald-900/40 text-emerald-300 shrink-0">${full ? 'Full' : 'Join'}</span>
        </div>
      </button>`;
    }).join('') : '<p class="text-center text-sm text-emerald-400/60 py-4">No public crews match your search.</p>';
    panel.innerHTML = `
      <div class="felt rounded-xl p-4 border border-violet-700/25 space-y-2">
        <p class="text-xs uppercase tracking-wider text-violet-300/80">Join with invite code</p>
        <div class="flex gap-2">
          <input id="club-invite-join-input" type="text" maxlength="8" placeholder="6-char code e.g. ACE42K"
            class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono uppercase tracking-widest" />
          <button id="btn-club-invite-join" type="button" class="px-4 py-2 rounded-lg bg-violet-900/50 border border-violet-600/40 text-violet-100 text-sm font-medium whitespace-nowrap">Join</button>
        </div>
        <p class="text-[10px] text-emerald-500/60">Works for public &amp; private crews · ask your leader for the code</p>
      </div>
      <div class="flex gap-2">
        <input id="club-search-input" type="search" placeholder="Search public crews…" value="${(this.clubSearchQuery || '').replace(/"/g, '&quot;')}"
          class="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm" />
        <button id="btn-club-create-open" type="button" class="px-4 py-2 rounded-lg bg-cyan-900/50 border border-cyan-600/40 text-cyan-200 text-sm font-medium whitespace-nowrap">+ Create</button>
      </div>
      <p class="text-[11px] text-emerald-500/60 text-center">Private crews are invite-only · max ${CLUB_MAX_MEMBERS} members per crew</p>
      <div id="club-search-results" class="grid gap-2">${cards}</div>`;
    const searchInput = document.getElementById('club-search-input');
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = '1';
      searchInput.addEventListener('input', (e) => this.setClubSearchQuery(e.target.value));
    }
  }

  renderClubs() {
    const main = document.getElementById('clubs-main-view');
    const hub = document.getElementById('clubs-hub-view');
    const browse = document.getElementById('clubs-browse-panel');
    const create = document.getElementById('clubs-create-view');
    const edit = document.getElementById('clubs-edit-view');
    if (!main || !create) return;
    const subView = this.clubsView;
    const overlay = subView === 'create' || subView === 'edit';
    main.classList.toggle('hidden', overlay);
    create.classList.toggle('hidden', subView !== 'create');
    if (edit) edit.classList.toggle('hidden', subView !== 'edit');
    if (overlay) return;
    const inCrew = !!this.save.club?.clubId && !!getPlayerClub(this.save);
    if (hub) hub.classList.toggle('hidden', !inCrew);
    if (browse) browse.classList.toggle('hidden', inCrew);
    const subtitle = document.querySelector('#screen-clubs .text-emerald-300\\/80.text-sm');
    if (subtitle) {
      subtitle.innerHTML = inCrew
        ? 'Your crew home — chat, compete, and climb the weekly leaderboard'
        : 'Team up with counters — create, search, and join clubs (max 50 members)';
    }
    if (inCrew) this.renderClubHub();
    else this.renderClubsBrowse();
  }

  /**
   * After a new shoe is created, replay burned-card tags into the counter.
   * Casinos burn one card after shuffle — it still leaves the shoe and affects RC.
   */
  initializeCounterFromBurnedCards() {
    this.counter.reset();
    if (this.shoe) {
      for (const burnedCard of this.shoe.burnedCards)
        this.counter.recordCardRemovedFromShoe(burnedCard);
    }
  }

  ensureShoe() {
    if (!this.shoe) { this.shoe = new Shoe(this.settings.numDecks); this.initializeCounterFromBurnedCards(); return; }
    if (this.shoe.needsReshuffle() || this.shoe.cardsRemaining < 20) {
      if (this.help.postShoeSummary() && (this.help.shoeHands > 0 || this.help.runningCountHistory.length > 0))
        this.pendingShoeReport = this.help.newShoe();
      else this.help.newShoe();
      this.stats.shoesPlayed++;
      this.checkDailyShoeComplete();
      this.shoe.reset();
      this.initializeCounterFromBurnedCards();
    }
  }

  refillPractice() {
    if (this.practice && this.bankroll < this.minBet) {
      this.bankroll = PRACTICE_BANKROLL;
      this.toast('Practice chips refilled!');
    }
  }

  startSession(practice, mode = practice ? 'practice-range' : 'campaign', drill = null, chapterId = null) {
    this.save.settings.practiceMode = practice;
    this.save.sessionMode = mode;
    this.save.sessionDrill = drill;
    this.save.sessionChapter = chapterId;
    const ch = chapterId ? CAMPAIGN_CHAPTERS.find(c => c.id === chapterId) : null;
    if (ch) {
      this.applyTheme(ch.theme);
      this.save.settings.rules = { ...defaultRules(), ...ch.rules };
      this.bankroll = ch.bankroll;
      this.save.campaign.chapter = CAMPAIGN_CHAPTERS.indexOf(ch);
    } else {
      this.bankroll = practice ? PRACTICE_BANKROLL : this.chips;
    }
    this.save.sessionActive = true;
    this.save.sessionHands = 0;
    this.save.sessionNetPL = 0;
    this.session = { start: this.bankroll, wagered: 0, netPL: 0, hands: 0, insTaken: 0, insWon: 0,
      decisions: 0, decisionsCorrect: 0, countQuizCorrect: 0, countQuizTotal: 0, betStreak: 0 };
    this.tableAiSeats = null;
    this.shoe = new Shoe(this.settings.numDecks);
    this.counter = this.createCounter();
    const profile = drill === 'count-shoe' ? 'drill-count' : drill === 'decisions' ? 'drill-decisions'
      : drill === 'betting' ? 'drill-betting' : drill === 'combined' ? 'drill-combined'
      : mode === 'tutorial' ? 'tutorial'
      : mode === 'daily' ? 'daily' : mode === 'campaign' ? 'campaign' : 'normal';
    const helpLevel = drill === 'combined' ? 1 : this.stats.helpLevel;
    this.help = new HelpSystem(helpLevel, profile);
    this.initializeCounterFromBurnedCards();
    this.initDailyIfNeeded();
    this.persist();
    if (drill === 'count-shoe') { this.startCountShoeDrill(); return; }
    if (drill === 'decisions') { this.startDecisionDrill(); return; }
    if (drill === 'betting') { this.startBettingDrill(); return; }
    if (drill === 'combined') { this.markDrillSessionStart(); this.combinedPracticeVisit = []; this.beginBetPhase(); return; }
    this.beginBetPhase();
  }

  continueSession() {
    const mode = this.save.sessionMode || (this.practice ? 'practice-range' : 'campaign');
    const drill = this.save.sessionDrill;
    const profile = drill === 'count-shoe' ? 'drill-count' : drill === 'decisions' ? 'drill-decisions'
      : drill === 'betting' ? 'drill-betting' : drill === 'combined' ? 'drill-combined'
      : mode === 'tutorial' ? 'tutorial'
      : mode === 'daily' ? 'daily' : mode === 'campaign' ? 'campaign'
      : mode === 'tables' ? 'normal' : 'normal';
    const baseSession = {
      start: this.bankroll, wagered: 0,
      netPL: this.save.sessionNetPL || 0, hands: this.save.sessionHands || 0,
      insTaken: 0, insWon: 0, decisions: 0, decisionsCorrect: 0,
      countQuizCorrect: 0, countQuizTotal: 0, betStreak: 0,
    };
    if (mode === 'tables' && this.save.sessionTableTier) {
      const tier = getTableTier(this.save.sessionTableTier);
      if (tier) {
        this.save.settings.minBet = tier.minBet;
        this.save.settings.unitSize = tier.unitSize;
        this.applyTheme(tier.theme);
        this.session = {
          ...baseSession,
          tableTierId: tier.id,
          tableEntryFee: tier.entryFeeChips,
          tableEntryGems: tier.entryFeeGems,
          tablePot: tier.entryFeeChips * 2,
          tableWinPayout: calcTableWinPayout(tier.entryFeeChips),
          tableMaxBet: tier.maxBet,
        };
      } else {
        this.session = baseSession;
      }
    } else {
      this.session = baseSession;
    }
    this.shoe = new Shoe(this.settings.numDecks);
    this.counter = this.createCounter();
    const helpLevel = drill === 'combined' ? 1 : this.stats.helpLevel;
    this.help = new HelpSystem(helpLevel, profile);
    this.initializeCounterFromBurnedCards();
    this.initDailyIfNeeded();
    if (drill === 'count-shoe') { this.startCountShoeDrill(); return; }
    if (drill === 'decisions') { this.startDecisionDrill(); return; }
    if (drill === 'betting') { this.startBettingDrill(); return; }
    if (drill === 'combined') { this.combinedPracticeVisit = this.combinedPracticeVisit || []; this.beginBetPhase(); return; }
    this.beginBetPhase();
  }

  combinedSessionSummaryText() {
    const visit = summarizeCombinedPracticeVisit(this.combinedPracticeVisit || []);
    if (!visit.hands) return 'No hands yet — play a hand to start tracking.';
    return `${visit.hands} hand${visit.hands === 1 ? '' : 's'} · Count ${visit.countAccuracy}% · Strategy ${visit.strategyAccuracy}%`;
  }

  finishCombinedPracticeSession() {
    const hands = this.combinedPracticeVisit || [];
    const visit = summarizeCombinedPracticeVisit(hands);
    if (visit.hands) {
      recordCombinedPracticeSession(this.save, { hands });
      recordTrainingHistorySession(this.save, 'combined', {
        attempts: visit.hands,
        accuracy: visit.countAccuracy,
        avgError: visit.countTotal
          ? Math.round((visit.countTotal - visit.countCorrect) / visit.countTotal * 10) / 10
          : 0,
        meta: {
          countAccuracy: visit.countAccuracy,
          strategyAccuracy: visit.strategyAccuracy,
          hands: visit.hands,
        },
      });
    }
    this.checkCampaignGoals();
    this.checkEngagement({ type: 'handEnd', handNetPL: 0, sessionNetPL: this.session?.netPL });
    this.combinedPracticeVisit = null;
    if (visit.hands) {
      this.finishDrillWithSummary('combined', { visit, hands });
      return;
    }
    this.save.sessionActive = false;
    this.save.sessionMode = null;
    this.save.sessionDrill = null;
    this.persist();
    this.phase = this.drillReturnPhase();
    this.render();
  }

  endSession() {
    if (this.save.sessionDrill === 'combined') {
      this.finishCombinedPracticeSession();
      return;
    }
    if (this.save.sessionMode === 'tournament') {
      if (this._tournamentSavedChips != null) {
        this.chips = this._tournamentSavedChips;
        this.save.bankroll = this._tournamentSavedChips;
      }
      const t = ensureTournament(this.save);
      t.match = null;
      this.save.sessionActive = false;
      this.save.sessionMode = null;
      this.save.sessionTableTier = null;
      this.session = null;
      this.persist();
      this.toast('Match forfeited — tournament run ended', 'error');
      t.active = false;
      t.status = 'idle';
      this.phase = 'tournament';
      this.render();
      return;
    }
    this.checkCampaignGoals();
    this.checkEngagement({ type: 'handEnd', handNetPL: 0, sessionNetPL: this.session?.netPL });
    if (this.save.sessionMode === 'tables' || this.save.sessionMode === 'special-event') {
      this.settleTableSessionIfNeeded();
    }
    this.save.sessionActive = false;
    this.save.sessionMode = null;
    this.save.sessionDrill = null;
    this.save.sessionTableTier = null;
    this.tableAiSeats = null;
    this.persist();
    this.phase = 'menu';
    this.render();
  }

  goMenu() {
    this.stopDealerTimer();
    this.dealerSession = null;
    this.closeAllModals();
    this.phase = 'menu';
    this.render();
  }

  openPracticeRange() { this.phase = 'practice-range'; this.render(); }

  openTrainingMode() {
    this.refreshDailyTrainingGoal();
    this.phase = 'training';
    this.render();
  }

  openTrainingHistory() {
    this.trainingHistoryFilter = this.trainingHistoryFilter || 'all';
    this.phase = 'training-history';
    this.render();
  }

  openMistakeReview() {
    this.mistakeReviewFilter = this.mistakeReviewFilter || 'all';
    this.phase = 'training-mistakes';
    this.render();
  }

  markDrillSessionStart() {
    this.drillSessionStartedAt = Date.now();
  }

  drillReturnPhase() {
    if (this.save.sessionMode === 'lobby') return 'menu';
    if (this.save.sessionMode === 'training') return 'training';
    return 'practice-range';
  }

  /** Unified end-of-session summary for all training drills. */
  finishDrillWithSummary(drillId, payload = {}) {
    const durationMs = this.drillSessionStartedAt
      ? Date.now() - this.drillSessionStartedAt
      : (payload.durationMs || 0);
    const summary = buildDrillSessionSummary(drillId, { ...payload, durationMs });
    if (summary.accuracy != null) {
      this.trackClubWeekly('training', { accuracy: summary.accuracy });
    }
    const comparison = updateDrillPersonalBest(this.save, summary);
    this.pendingDrillSummary = summary;
    this.drillSummaryComparison = comparison;
    this.drillSummaryReturnPhase = this.drillReturnPhase();
    this.drillSummaryDrillId = drillId;
    this.drillSummaryExtras = payload.chartHtml ? { chartHtml: payload.chartHtml } : null;
    this.save.sessionActive = false;
    this.save.sessionDrill = null;
    this.betSpreadClearTimer?.();
    this.speedDrillCleanupTimer?.();
    this.persist();
    this.phase = 'drill-session-summary';
    this.render();
  }

  renderDrillSessionSummary() {
    const summary = this.pendingDrillSummary;
    if (!summary) return;
    document.getElementById('drill-summary-title').textContent = summary.drillLabel;
    document.getElementById('drill-summary-subtitle').textContent = summary.subtitle || 'Session summary';
    document.getElementById('drill-summary-body').innerHTML =
      renderDrillSessionSummaryHtml(summary, this.drillSummaryComparison);
    const chartWrap = document.getElementById('drill-summary-chart');
    const chartHtml = this.drillSummaryExtras?.chartHtml;
    if (chartWrap) {
      if (chartHtml) {
        chartWrap.classList.remove('hidden');
        chartWrap.innerHTML = chartHtml;
      } else {
        chartWrap.classList.add('hidden');
        chartWrap.innerHTML = '';
      }
    }
    const backBtn = document.getElementById('btn-drill-summary-back');
    if (backBtn) {
      const phase = this.drillSummaryReturnPhase;
      backBtn.textContent = phase === 'menu' ? '← Lobby' : phase === 'training' ? '← Training Mode' : '← Practice Range';
    }
  }

  drillSummaryGoBack() {
    this.pendingDrillSummary = null;
    this.drillSummaryComparison = null;
    this.drillSummaryExtras = null;
    this.drillSessionStartedAt = null;
    this.phase = this.drillSummaryReturnPhase || 'training';
    this.save.sessionMode = null;
    this.render();
  }

  drillSummaryRetry() {
    const drillId = this.drillSummaryDrillId;
    this.pendingDrillSummary = null;
    this.drillSummaryComparison = null;
    this.drillSummaryExtras = null;
    this.drillSessionStartedAt = null;
    if (drillId === 'dealer-mode') {
      this.openDealerMode(this.save.sessionMode === 'lobby' ? 'lobby' : 'training');
      this.startDealerShift();
      return;
    }
    this.launchTrainingDrill(trainingDrillCardId(drillId));
  }

  /** Launch a live drill from Training Mode (or Practice Range). */
  launchTrainingDrill(drillId) {
    const entry = TRAINING_DRILLS.find(d => d.id === drillId || d.launch === drillId);
    if (!entry || entry.status !== 'live') {
      this.toast('This drill is coming soon!', 'info');
      return;
    }
    const launch = entry.launch || entry.id;
    this.save.sessionMode = 'training';
    if (launch === 'count-speed') {
      this.openSpeedDrill();
      return;
    }
    if (launch === 'true-count') {
      this.openTrueCountDrill();
      return;
    }
    if (launch === 'index-plays') {
      this.openIndexPlayDrill();
      return;
    }
    if (launch === 'bet-spread') {
      this.openBetSpreadDrill();
      return;
    }
    if (launch === 'dealer-mode') {
      this.openDealerMode();
      return;
    }
    if (launch === 'card-bursts') {
      this.openCardBurstDrill();
      return;
    }
    if (launch === 'decks-left') {
      this.openDecksLeftDrill();
      return;
    }
    this.startSession(true, 'training', launch);
  }

  /** Open tutorial slideshow; restart from step 1 if previously completed. */
  openTutorial() {
    if (this.save.tutorial.completed) {
      this.save.tutorial.step = 0;
      this.save.tutorial.completed = false;
      this.persist();
    }
    this.phase = 'tutorial';
    this.render();
  }

  tutorialStepIndex() {
    return Math.max(0, Math.min(this.save.tutorial?.step ?? 0, TUTORIAL_STEPS.length - 1));
  }

  canTutorialNav() {
    return Date.now() >= this.tutorialNavBusyUntil;
  }

  /** Brief debounce — does not disable buttons (avoids stuck pointer-events). */
  lockTutorialNav(ms = 280) {
    this.tutorialNavBusyUntil = Date.now() + ms;
    const screen = document.getElementById('screen-tutorial');
    if (screen) screen.dataset.navBusy = 'true';
    setTimeout(() => {
      if (Date.now() >= this.tutorialNavBusyUntil) {
        const el = document.getElementById('screen-tutorial');
        if (el) delete el.dataset.navBusy;
      }
    }, ms + 20);
  }

  /** Leave tutorial without marking complete — returns to main menu. */
  exitTutorial() {
    if (!this.canTutorialNav()) return;
    this.lockTutorialNav();
    this.goMenu();
  }

  /** Skip all tutorial pages and jump into Full Campaign. */
  skipTutorial() {
    if (!this.canTutorialNav()) return;
    this.lockTutorialNav();
    this.save.tutorial.completed = true;
    this.save.tutorial.step = TUTORIAL_STEPS.length - 1;
    this.persist();
    this.startSession(false, 'campaign', null, 'classic');
  }
  openCampaign() { this.phase = 'campaign'; this.render(); }
  openDaily() {
    this.dailyChallenge = dailyChallengeForDate();
    if (this.save.daily.lastDate !== this.dailyChallenge.date) {
      this.save.daily = { lastDate: this.dailyChallenge.date, challengeId: this.dailyChallenge.id, completed: false, progress: {} };
      this.persist();
    }
    ensureDailyRewardsCurrent(this.save);
    this.refreshDailyTrainingGoal();
    this.phase = 'daily';
    this.render();
  }

  openDailyRewards() {
    ensureDailyRewardsCurrent(this.save);
    this.phase = 'daily-rewards';
    this.render();
  }

  maybeShowDailyRewardModal() {
    if (this._dailyRewardModalShown || new URLSearchParams(location.search).has('test')) return;
    ensureDailyRewardsCurrent(this.save);
    if (!canClaimDailyLogin(this.save) || this.phase !== 'menu') return;
    this._dailyRewardModalShown = true;
    this.showDailyRewardClaimModal();
  }

  showDailyRewardClaimModal() {
    ensureDailyRewardsCurrent(this.save);
    const preview = computeDailyLoginReward(this.save);
    const dr = this.save.dailyRewards;
    document.getElementById('daily-reward-modal-title').textContent = dr.streak > 1
      ? `Day ${dr.streak} streak!`
      : 'Welcome back, counter!';
    document.getElementById('daily-reward-modal-desc').textContent = canClaimDailyLogin(this.save)
      ? 'Your daily login reward is ready — claim chips and gems to keep your streak alive.'
      : 'You already claimed today\'s reward. Come back tomorrow!';
    const payout = document.getElementById('daily-reward-modal-payout');
    payout.innerHTML = `🪙 <strong>${preview.chips.toLocaleString()}</strong> chips`
      + (preview.gems ? ` · 💎 <strong>${preview.gems}</strong> gem${preview.gems === 1 ? '' : 's'}` : '')
      + (preview.vipActive ? '<br><span class="text-purple-300/90 text-xs">VIP 2× chip bonus applied</span>' : '');
    document.getElementById('daily-reward-modal-streak').textContent = dr.longestStreak
      ? `🔥 ${dr.streak}-day streak · best ${dr.longestStreak} days`
      : `🔥 Start your login streak today`;
    const btn = document.getElementById('btn-daily-reward-claim');
    if (btn) {
      btn.textContent = canClaimDailyLogin(this.save) ? 'Claim Reward' : 'Got it';
      btn.disabled = false;
    }
    document.getElementById('modal-daily-reward').showModal();
  }

  claimDailyLoginFromModal() {
    if (!canClaimDailyLogin(this.save)) {
      document.getElementById('modal-daily-reward').close();
      return;
    }
    const result = claimDailyLoginReward(this.save);
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    this.checkEngagement();
    this.persist();
    Sounds.play('level');
    const r = result.reward;
    this.toast(`Daily reward claimed! +${r.chips.toLocaleString()} chips${r.gems ? ` · +${r.gems} 💎` : ''} · ${result.streak}-day streak 🔥`, 'level', 5000);
    document.getElementById('modal-daily-reward').close();
    this.renderCurrencyDisplays();
    if (this.phase === 'daily-rewards') this.renderDailyRewards();
    if (this.phase === 'daily') this.renderDaily();
    if (this.phase === 'menu') this.renderMenu();
  }

  async connectSocialProvider(provider) {
    const label = provider === 'facebook' ? 'Facebook' : 'Google';
    const configured = provider === 'facebook'
      ? ExternalAuth.isFacebookConfigured()
      : ExternalAuth.isGoogleConfigured();
    this.toast(configured ? `Opening ${label} OAuth…` : `Connecting ${label} (local)…`, 'info', 2500);
    const result = provider === 'facebook'
      ? await ExternalAuth.connectFacebook(this.save)
      : await ExternalAuth.connectGoogle(this.save);
    if (!result.ok) {
      this.toast(result.error || `${label} connect failed`, 'error');
      return;
    }
    this.checkEngagement();
    this.persist();
    Sounds.play('chip');
    const modeNote = result.mode === 'oauth' ? ' (OAuth)' : result.mode === 'simulated' ? ' (local)' : '';
    if (result.bonus) {
      this.toast(`${label} connected${modeNote}! +${result.bonus.chips} chips · +${result.bonus.gems} 💎`, 'level', 4500);
    } else {
      this.toast(`${label} connected${modeNote}`, 'success');
    }
    this.renderCurrencyDisplays();
    if (this.phase === 'daily-rewards') this.renderDailyRewards();
  }

  purchaseVipPassAction() {
    const result = ExternalIAP.purchaseVip(this.save);
    if (!result.ok) {
      this.toast(result.error, 'error', 4000);
      return;
    }
    if (result.mode === 'stripe') {
      this.toast(result.message, 'info', 6000);
      return;
    }
    this.checkEngagement();
    this.persist();
    Sounds.play('level');
    this.toast(`VIP Pass activated! ${VIP_PASS_DURATION_DAYS} days · expires ${result.expiresAt}`, 'level', 5000);
    this.renderCurrencyDisplays();
    if (this.phase === 'daily-rewards') this.renderDailyRewards();
    if (this.phase === 'menu') this.renderMenu();
  }

  saveExternalConfigFromSettings() {
    const config = {
      oauth: {
        googleClientId: (document.getElementById('cfg-google-client-id')?.value || '').trim(),
        facebookAppId: (document.getElementById('cfg-facebook-app-id')?.value || '').trim(),
      },
      iap: {
        stripePaymentLink: (document.getElementById('cfg-stripe-vip-link')?.value || '').trim(),
      },
    };
    const saved = saveExternalConfig(config);
    const status = document.getElementById('external-config-status');
    if (status) {
      status.textContent = saved.ok
        ? `Saved — OAuth: ${config.oauth.googleClientId || config.oauth.facebookAppId ? 'on' : 'off'} · IAP: ${config.iap.stripePaymentLink ? 'Stripe link' : 'gems'}`
        : (saved.error || 'Save failed');
    }
    this.toast(saved.ok ? 'External services config saved' : (saved.error || 'Save failed'), saved.ok ? 'success' : 'error');
  }

  loadExternalConfigIntoSettings() {
    const cfg = loadExternalConfig();
    const g = document.getElementById('cfg-google-client-id');
    const f = document.getElementById('cfg-facebook-app-id');
    const s = document.getElementById('cfg-stripe-vip-link');
    if (g) g.value = cfg.oauth.googleClientId || '';
    if (f) f.value = cfg.oauth.facebookAppId || '';
    if (s) s.value = cfg.iap.stripePaymentLink || '';
  }

  contributeClubBankrollAction() {
    const chips = parseInt(document.getElementById('club-bankroll-contribute-chips')?.value, 10) || 0;
    const gems = parseInt(document.getElementById('club-bankroll-contribute-gems')?.value, 10) || 0;
    const result = contributeToClubBankroll(this.save, { chips, gems });
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    this.persist();
    Sounds.play('chip');
    this.toast(`Contributed ${result.chips ? `${result.chips} chips` : ''}${result.chips && result.gems ? ' · ' : ''}${result.gems ? `${result.gems} 💎` : ''} to crew bankroll`, 'success', 4000);
    this.renderCurrencyDisplays();
    this.renderClubHub();
  }

  distributeClubBankrollAction(targetId) {
    const chips = parseInt(document.getElementById('club-bankroll-distribute-chips')?.value, 10) || 0;
    const gems = parseInt(document.getElementById('club-bankroll-distribute-gems')?.value, 10) || 0;
    const result = distributeClubBankroll(this.save, targetId, { chips, gems });
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    this.persist();
    Sounds.play('chip');
    const sim = result.simulated ? ' (simulated for demo member)' : '';
    this.toast(`Distributed ${result.chips} chips to ${result.target.displayName}${sim}`, 'success', 4000);
    this.renderClubHub();
  }

  copyClubInviteCode() {
    const club = getPlayerClub(this.save);
    if (!club?.inviteCode) return;
    const link = buildClubInviteUrl(club.inviteCode);
    navigator.clipboard?.writeText(link).then(() => {
      this.toast('Invite link copied — share with friends!', 'success', 3500);
    }).catch(() => {
      navigator.clipboard?.writeText(club.inviteCode).then(() => {
        this.toast(`Invite code copied: ${club.inviteCode}`, 'success', 3000);
      }).catch(() => {
        this.toast(`Invite: ${link}`, 'info', 5000);
      });
    });
  }

  regenerateClubInviteAction() {
    const result = regenerateClubInviteCode(this.save);
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    this.toast(`New invite code: ${result.inviteCode}`, 'success', 4000);
    this.renderClubHub();
  }

  joinClubByInviteAction() {
    const code = document.getElementById('club-invite-join-input')?.value;
    const result = joinClubByInviteCode(this.save, code);
    if (!result.ok) {
      this.toast(result.error, 'error');
      return;
    }
    this.persist();
    Sounds.play('level');
    this.toast(`Joined ${result.club.name} via invite!`, 'level', 4000);
    this.clubsView = 'hub';
    this.render();
  }

  claimVipTrialAction() {
    const result = claimVipTrial(this.save);
    if (!result.ok) {
      this.toast(result.error, 'error', 4000);
      return;
    }
    this.checkEngagement();
    this.persist();
    Sounds.play('level');
    this.toast(`VIP trial started! ${VIP_TRIAL_DAYS} days of premium perks`, 'level', 5000);
    if (this.phase === 'daily-rewards') this.renderDailyRewards();
    if (this.phase === 'menu') this.renderMenu();
  }

  refreshDailyTrainingGoal() {
    this.dailyTrainingGoal = dailyTrainingGoalForDate();
    ensureDailyTrainingCurrent(this.save, this.dailyTrainingGoal);
  }

  initDailyIfNeeded() {
    if (this.sessionMode !== 'daily') return;
    this.dailyChallenge = dailyChallengeForDate();
    this.dailyTracker = { ...(this.save.daily.progress || {}) };
  }

  startCountShoeDrill() {
    this.markDrillSessionStart();
    this.drillState = { cardsDealt: 0, quizDone: false };
    this.shoe = new Shoe(1);
    this.counter = this.createCounter();
    this.initializeCounterFromBurnedCards();
    this.phase = 'drill-count';
    this.render();
  }

  speedDrillCleanupTimer() {
    if (this.drillState?.dealTimer) {
      clearTimeout(this.drillState.dealTimer);
      this.drillState.dealTimer = null;
    }
  }

  /** Open Running Count Speed Drill (setup screen). */
  openSpeedDrill() {
    this.speedDrillCleanupTimer();
    this.markDrillSessionStart();
    this.save.sessionActive = false;
    this.save.sessionDrill = 'count-speed';
    this.speedDrillVisit = [];
    const prefs = this.save.speedDrill?.prefs || defaultSpeedDrillPrefs();
    this.drillState = {
      subPhase: 'setup',
      cardTarget: prefs.cardCount,
      speed: prefs.speed,
      showCount: prefs.showCount,
      cardsDealt: 0,
      lastCard: null,
      lastTag: 0,
      paused: false,
      dealTimer: null,
    };
    this.phase = 'drill-speed';
    this.help = new HelpSystem(this.stats.helpLevel, 'drill-speed');
    this.persist();
    this.render();
  }

  readSpeedDrillPrefsFromUI() {
    const cardTarget = parseInt(document.getElementById('speed-drill-cards')?.value || '20', 10);
    const speed = document.getElementById('speed-drill-speed')?.value || 'normal';
    const showCount = !!document.getElementById('speed-drill-show-count')?.checked;
    return {
      cardTarget: SPEED_DRILL_CARD_OPTIONS.includes(cardTarget) ? cardTarget : 20,
      speed: SPEED_DRILL_MS[speed] ? speed : 'normal',
      showCount,
    };
  }

  startSpeedDrillRound() {
    const prefs = this.readSpeedDrillPrefsFromUI();
    this.speedDrillCleanupTimer();
    this.shoe = new Shoe(2);
    this.counter = new CardCounter('hi-lo');
    this.counter.reset();
    this.drillState = {
      subPhase: 'dealing',
      cardTarget: prefs.cardTarget,
      speed: prefs.speed,
      showCount: prefs.showCount,
      cardsDealt: 0,
      lastCard: null,
      lastTag: 0,
      paused: false,
      dealTimer: null,
    };
    Sounds.init();
    this.renderSpeedDrill();
    this.scheduleSpeedDrillDeal();
  }

  scheduleSpeedDrillDeal() {
    const ds = this.drillState;
    if (!ds || ds.subPhase !== 'dealing' || ds.paused) return;
    const delay = SPEED_DRILL_MS[ds.speed] || SPEED_DRILL_MS.normal;
    ds.dealTimer = setTimeout(() => this.speedDrillDealNext(), delay);
  }

  speedDrillDealNext() {
    const ds = this.drillState;
    if (!ds || ds.subPhase !== 'dealing' || ds.paused) return;
    if (!this.shoe || this.shoe.cardsRemaining < 1) {
      this.speedDrillFinishDealing();
      return;
    }
    const card = this.shoe.deal();
    const tag = this.counter.recordCardRemovedFromShoe(card);
    ds.cardsDealt++;
    ds.lastCard = card;
    ds.lastTag = tag;
    Sounds.play('card');
    if (ds.cardsDealt >= ds.cardTarget) {
      this.renderSpeedDrill();
      this.speedDrillFinishDealing();
      return;
    }
    this.renderSpeedDrill();
    this.scheduleSpeedDrillDeal();
  }

  speedDrillFinishDealing() {
    this.speedDrillCleanupTimer();
    if (!this.drillState) return;
    this.drillState.subPhase = 'quiz';
    this.drillState.paused = false;
    this.renderSpeedDrill();
    document.getElementById('speed-drill-guess')?.focus();
  }

  speedDrillTogglePause() {
    const ds = this.drillState;
    if (!ds || ds.subPhase !== 'dealing') return;
    ds.paused = !ds.paused;
    if (ds.paused) {
      this.speedDrillCleanupTimer();
    } else {
      this.scheduleSpeedDrillDeal();
    }
    this.renderSpeedDrill();
  }

  submitSpeedDrillGuess(rawGuess) {
    const parsed = validateRunningCountGuess(rawGuess);
    if (!parsed.ok) {
      this.toast(parsed.error, 'error');
      return;
    }
    const guess = parsed.value;
    const actual = this.counter.runningCount;
    const error = Math.abs(guess - actual);
    const withinOne = error <= 1;
    const exact = guess === actual;
    const ds = this.drillState || {};
    recordSpeedDrillSession(this.save, {
      cardCount: ds.cardTarget || 20,
      speed: ds.speed || 'normal',
      showCount: !!ds.showCount,
      guess,
      actual,
    });
    recordTrainingHistorySession(this.save, 'count-speed', {
      attempts: 1,
      accuracy: withinOne ? 100 : 0,
      avgError: error,
      meta: { cardCount: ds.cardTarget || 20, speed: ds.speed || 'normal', guess, actual, exact },
    });
    if (!withinOne) {
      recordMistakeReviewEntry(this.save, {
        drillId: 'count-speed',
        category: 'count',
        context: `After ${ds.cardTarget || 20} cards (${ds.speed || 'normal'} pace)`,
        wrong: fmtSignedCount(guess),
        correct: fmtSignedCount(actual),
        detail: `Off by ${error}`,
        meta: { guess, actual, error },
      });
    }
    this.stats.countGuesses++;
    if (withinOne) this.stats.countCorrect++;
    this.persist();
    if (withinOne) Sounds.play('count');
    else Sounds.play('loss');
    this.drillState.subPhase = 'result';
    this.drillState.lastResult = { guess, actual, error, withinOne, exact };
    this.speedDrillVisit = this.speedDrillVisit || [];
    this.speedDrillVisit.push({ guess, actual, error, withinOne, exact });
    const visit = summarizeSpeedDrillRounds(this.speedDrillVisit || []);
    this.checkDailyTrainingProgress('drillSession', {
      drillId: 'count-speed',
      accuracy: visit.accuracy,
      attempts: visit.total,
    });
    this.renderSpeedDrill();
  }

  formatSpeedDrillResultMessage(result) {
    const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
    if (result.exact) {
      return `<p class="text-lg font-bold text-green-400">Correct! Running count = ${fmt(result.actual)}</p>`;
    }
    if (result.withinOne) {
      return `<p class="text-lg font-bold text-amber-300">Close! Actual count was ${fmt(result.actual)} (you said ${fmt(result.guess)}, off by ${result.error})</p>`;
    }
    return `<p class="text-lg font-bold text-red-300">Not quite — actual count was ${fmt(result.actual)} (you said ${fmt(result.guess)}, off by ${result.error})</p>`;
  }

  betSpreadClearTimer() {
    if (this.betSpreadTimer) {
      clearInterval(this.betSpreadTimer);
      this.betSpreadTimer = null;
    }
  }

  openBetSpreadDrill() {
    this.speedDrillCleanupTimer();
    this.betSpreadClearTimer();
    this.save.sessionActive = false;
    this.save.sessionDrill = 'bet-spread';
    this.betSpreadDrillVisit = [];
    const prefs = this.save.betSpreadDrill?.prefs || defaultBetSpreadDrillPrefs();
    this.drillState = { subPhase: 'setup', ...prefs, roundIndex: 0, roundResults: [], currentProblem: null };
    this.phase = 'drill-bet-spread';
    this.help = new HelpSystem(this.stats.helpLevel, 'drill-bet-spread');
    this.persist();
    this.render();
  }

  readBetSpreadDrillPrefsFromUI() {
    const preset = document.getElementById('bet-spread-preset')?.value || 'standard';
    const scenario = document.getElementById('bet-spread-scenario')?.value || 'mixed';
    const roundSize = parseInt(document.getElementById('bet-spread-rounds')?.value || '10', 10);
    const countingSystem = document.getElementById('bet-spread-system')?.value === 'ko' ? 'ko' : 'hi-lo';
    const bankroll = Math.max(100, Math.floor(Number(document.getElementById('bet-spread-bankroll')?.value) || BET_SPREAD_DEFAULT_BANKROLL));
    return {
      preset: BET_SPREAD_PRESETS[preset] ? preset : 'standard',
      scenario: BET_SPREAD_SCENARIOS[scenario] ? scenario : 'mixed',
      roundSize: BET_SPREAD_ROUND_OPTIONS.includes(roundSize) ? roundSize : 10,
      countingSystem,
      showKelly: !!document.getElementById('bet-spread-show-kelly')?.checked,
      heatSim: !!document.getElementById('bet-spread-heat-sim')?.checked,
      timedRounds: !!document.getElementById('bet-spread-timed')?.checked,
      customMinUnits: Math.max(1, Math.floor(Number(document.getElementById('bet-spread-min-units')?.value) || 1)),
      customMaxUnits: Math.max(1, Math.floor(Number(document.getElementById('bet-spread-max-units')?.value) || 8)),
      bankroll,
      unitSize: 10,
    };
  }

  startBetSpreadDrillRound() {
    this.markDrillSessionStart();
    const prefs = this.readBetSpreadDrillPrefsFromUI();
    const range = resolveBetSpreadRange(prefs);
    this.betSpreadDrillVisit = this.betSpreadDrillVisit || [];
    this.betSpreadClearTimer();
    this.drillState = {
      subPhase: 'problem',
      ...prefs,
      rangeLabel: range.label,
      minUnits: range.minUnits,
      maxUnits: range.maxUnits,
      unitSize: range.unitSize,
      roundIndex: 0,
      roundResults: [],
      lastChosenUnits: null,
      currentProblem: generateBetSpreadProblem(prefs.scenario, range, {
        bankroll: prefs.bankroll,
        countingSystem: prefs.countingSystem,
        numDecks: this.settings?.numDecks || 6,
      }),
    };
    this.renderBetSpreadDrill();
    this.startBetSpreadRoundTimer();
  }

  startBetSpreadRoundTimer() {
    this.betSpreadClearTimer();
    const ds = this.drillState;
    if (!ds?.timedRounds || ds.subPhase !== 'problem') return;
    ds.timerMsLeft = BET_SPREAD_TIMER_MS;
    const timerEl = document.getElementById('bet-spread-timer');
    if (timerEl) timerEl.classList.remove('hidden');
    this.betSpreadTimer = setInterval(() => {
      ds.timerMsLeft = Math.max(0, ds.timerMsLeft - 100);
      if (timerEl) timerEl.textContent = `${(ds.timerMsLeft / 1000).toFixed(1)}s`;
      if (ds.timerMsLeft <= 0) this.submitBetSpreadTimeout();
    }, 100);
  }

  submitBetSpreadTimeout() {
    this.betSpreadClearTimer();
    this._submitBetSpreadChoiceInner(0, { timedOut: true });
  }

  submitBetSpreadChoice(chosenUnits) {
    this.betSpreadClearTimer();
    this._submitBetSpreadChoiceInner(chosenUnits, {});
  }

  _submitBetSpreadChoiceInner(chosenUnits, opts = {}) {
    const ds = this.drillState;
    if (!ds || ds.subPhase !== 'problem' || !ds.currentProblem) return;
    const prob = ds.currentProblem;
    const units = opts.timedOut
      ? 0
      : Math.max(ds.minUnits, Math.min(Math.floor(Number(chosenUnits) || 0), ds.maxUnits));
    const exact = !opts.timedOut && isBetSpreadChoiceExact(units, prob.optimalUnits);
    let appropriate = !opts.timedOut && isBetSpreadChoiceAppropriate(units, prob.optimalUnits);
    const heat = detectBetSpreadHeat(ds.lastChosenUnits, units);
    const heatPenalty = ds.heatSim && heat.heated && !opts.timedOut;
    if (heatPenalty) appropriate = false;
    const bankrollStressed = !opts.timedOut && betSpreadBankrollStress(units * prob.unitSize, prob.bankroll).stressed;
    const result = {
      trueCount: prob.trueCount,
      chosenUnits: opts.timedOut ? 0 : units,
      optimalUnits: prob.optimalUnits,
      exact,
      appropriate,
      heatPenalty,
      heatJump: heat.jump,
      timedOut: !!opts.timedOut,
      bankrollStressed,
      scenarioClass: prob.scenarioClass,
    };
    ds.roundResults.push(result);
    this.betSpreadDrillVisit.push(result);
    if (!opts.timedOut) ds.lastChosenUnits = units;

    const feedback = document.getElementById('bet-spread-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      const explain = explainBetSpreadAnswer(prob, opts.timedOut ? 0 : units, prob.optimalUnits, { heat, timedOut: opts.timedOut });
      if (opts.timedOut) {
        feedback.className = 'rounded-xl px-4 py-3 text-sm bg-red-950/40 border border-red-700/30 text-red-100';
        feedback.innerHTML = `<strong>⏱ Time's up — needed ${prob.optimalUnits} units ($${prob.optimalUnits * prob.unitSize})</strong><br><span class="text-red-100/90">${explain}</span>`;
      } else if (exact && !heatPenalty) {
        feedback.className = 'rounded-xl px-4 py-3 text-sm bg-green-950/50 border border-green-600/40 text-green-200';
        feedback.innerHTML = `<strong>✓ Perfect — ${units} unit${units > 1 ? 's' : ''} ($${units * prob.unitSize})</strong><br><span class="text-emerald-200/85">${explain}</span>`;
      } else if (appropriate) {
        feedback.className = 'rounded-xl px-4 py-3 text-sm bg-amber-950/40 border border-amber-600/30 text-amber-100';
        feedback.innerHTML = `<strong>~ Close — optimal ${prob.optimalUnits} units ($${prob.optimalUnits * prob.unitSize})</strong><br><span class="text-amber-100/90">${explain}</span>`;
      } else {
        feedback.className = 'rounded-xl px-4 py-3 text-sm bg-red-950/40 border border-red-700/30 text-red-100';
        const title = heatPenalty ? `🔥 Heat penalty — ${heat.jump}u jump` : `✗ ${units} units — needed ${prob.optimalUnits} ($${prob.optimalUnits * prob.unitSize})`;
        feedback.innerHTML = `<strong>${title}</strong><br><span class="text-red-100/90">${explain}</span>`;
      }
    }
    if (exact && !heatPenalty) Sounds.play('chip');
    else if (appropriate) Sounds.play('count');
    else Sounds.play('loss');

    if (!appropriate) {
      const tcFmt = formatTrueCountAnswer(prob.trueCount, 'decimal');
      const wrongLabel = opts.timedOut
        ? 'Timed out'
        : `${units} unit${units === 1 ? '' : 's'} ($${units * prob.unitSize})`;
      recordMistakeReviewEntry(this.save, {
        drillId: 'bet-spread',
        category: 'spread',
        context: `True count ${tcFmt} · ${BET_SPREAD_SCENARIOS[prob.scenarioClass]?.label || prob.scenarioClass || 'mixed'}`,
        wrong: wrongLabel,
        correct: `${prob.optimalUnits} unit${prob.optimalUnits === 1 ? '' : 's'} ($${prob.optimalUnits * prob.unitSize})`,
        detail: heatPenalty ? `Heat penalty — jumped ${heat.jump} units from last bet` : explainBetSpreadAnswer(prob, opts.timedOut ? 0 : units, prob.optimalUnits, { heat, timedOut: opts.timedOut }),
        meta: { trueCount: prob.trueCount, chosenUnits: units, optimalUnits: prob.optimalUnits, heatPenalty },
      });
    }

    const advanceDelay = opts.timedOut ? 1400 : exact && !heatPenalty ? 900 : appropriate ? 1200 : 1500;
    ds.roundIndex++;
    if (ds.roundIndex >= ds.roundSize) {
      const sum = summarizeBetSpreadRounds(ds.roundResults);
      recordBetSpreadDrillSession(this.save, {
        preset: ds.preset,
        scenario: ds.scenario,
        roundSize: ds.roundSize,
        countingSystem: ds.countingSystem,
        timedRounds: ds.timedRounds,
        showKelly: ds.showKelly,
        heatSim: ds.heatSim,
        customMinUnits: ds.customMinUnits,
        customMaxUnits: ds.customMaxUnits,
        bankroll: ds.bankroll,
        accuracy: sum.accuracy,
        exactPct: sum.exactPct,
        rampScore: sum.rampScore,
        heatFlags: sum.heatFlags,
        total: sum.total,
      });
      recordTrainingHistorySession(this.save, 'bet-spread', {
        attempts: sum.total,
        accuracy: sum.accuracy,
        avgError: sum.avgUnitError,
        meta: {
          preset: ds.preset, scenario: ds.scenario, exactPct: sum.exactPct,
          rampScore: sum.rampScore, heatFlags: sum.heatFlags, countingSystem: ds.countingSystem,
        },
      });
      this.persist();
      const extras = [
        `${sum.exactPct}% exact bets`,
        sum.rampScore != null ? `Ramp score ${sum.rampScore}%` : '',
      ].filter(Boolean);
      const subtitle = `${BET_SPREAD_PRESETS[ds.preset]?.label || ds.preset} · ${BET_SPREAD_SCENARIOS[ds.scenario]?.label || ''}`;
      setTimeout(() => {
        this.betSpreadClearTimer();
        this.finishDrillWithSummary('bet-spread', {
          rounds: ds.roundResults,
          sum,
          subtitle,
          extras,
          meta: { preset: ds.preset, scenario: ds.scenario, countingSystem: ds.countingSystem },
          chartHtml: `<p class="text-xs uppercase tracking-wider text-cyan-400/80 mb-2 text-center">Bet vs optimal</p>${renderBetSpreadSessionChartHtml(ds.roundResults || [], ds.maxUnits || 6)}`,
        });
      }, advanceDelay);
      return;
    }
    setTimeout(() => {
      ds.currentProblem = generateBetSpreadProblem(ds.scenario, {
        minUnits: ds.minUnits, maxUnits: ds.maxUnits, unitSize: ds.unitSize,
      }, {
        bankroll: ds.bankroll,
        countingSystem: ds.countingSystem,
        numDecks: this.settings?.numDecks || 6,
      });
      feedback?.classList.add('hidden');
      this.renderBetSpreadDrill();
      this.startBetSpreadRoundTimer();
    }, opts.timedOut ? 1100 : exact && !heatPenalty ? 750 : appropriate ? 1000 : 1300);
  }

  renderBetSpreadDrillStatsPanel() {
    const el = document.getElementById('bet-spread-stats');
    if (!el) return;
    const visit = summarizeBetSpreadRounds(this.betSpreadDrillVisit || []);
    const sessionBlock = visit.total
      ? `<div class="mb-3 pb-3 border-b border-white/10">
          <p class="text-xs uppercase tracking-wider text-cyan-400/80 mb-2 text-center">This session</p>
          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div class="rounded-lg bg-cyan-950/30 p-2 border border-cyan-800/25">
              <div class="text-emerald-400/70">Appropriate</div>
              <div class="font-bold text-lg text-cyan-200">${visit.accuracy}%</div>
            </div>
            <div class="rounded-lg bg-cyan-950/30 p-2 border border-cyan-800/25">
              <div class="text-emerald-400/70">Exact</div>
              <div class="font-bold text-lg text-cyan-200">${visit.exactPct}%</div>
            </div>
            <div class="rounded-lg bg-cyan-950/30 p-2 border border-cyan-800/25">
              <div class="text-emerald-400/70">Avg off</div>
              <div class="font-bold text-lg text-cyan-200">${visit.avgUnitError}u</div>
            </div>
          </div>
          ${visit.rampScore != null ? `<p class="text-[10px] text-emerald-500/60 text-center mt-2">Ramp: avg ${visit.avgChosenLow}u low true count → ${visit.avgChosenHigh}u high true count</p>` : ''}
          ${visit.heatFlags ? `<p class="text-[10px] text-orange-400/70 text-center">Heat flags: ${visit.heatFlags}</p>` : ''}
        </div>`
      : '';
    const sessions = this.save.betSpreadDrill?.sessions || [];
    const avgAcc = sessions.length
      ? Math.round(sessions.reduce((a, s) => a + s.accuracy, 0) / sessions.length)
      : 0;
    const lifetimeBlock = sessions.length
      ? `<p class="text-xs uppercase tracking-wider text-amber-400/80 mb-2 text-center">All time</p>
         <div class="grid grid-cols-2 gap-2 text-center text-xs">
           <div class="rounded-lg bg-black/30 p-2"><div class="text-emerald-400/70">Avg appropriate</div><div class="font-bold text-lg text-emerald-200">${avgAcc}%</div></div>
           <div class="rounded-lg bg-black/30 p-2"><div class="text-emerald-400/70">Sessions</div><div class="font-bold text-lg text-emerald-200">${sessions.length}</div></div>
         </div>`
      : '<p class="text-emerald-400/60 text-center text-xs">Start a session to track your spread accuracy.</p>';
    el.innerHTML = sessionBlock + lifetimeBlock;
  }

  renderBetSpreadDrill() {
    const ds = this.drillState || { subPhase: 'setup' };
    const prefs = this.save.betSpreadDrill?.prefs || defaultBetSpreadDrillPrefs();
    const sub = ds.subPhase || 'setup';

    document.getElementById('bet-spread-setup')?.classList.toggle('hidden', sub !== 'setup');
    document.getElementById('bet-spread-active')?.classList.toggle('hidden', sub !== 'problem');
    document.getElementById('bet-spread-summary')?.classList.toggle('hidden', sub !== 'summary');
    document.getElementById('bet-spread-chart-wrap')?.classList.toggle('hidden', sub !== 'summary');
    document.getElementById('bet-spread-timer')?.classList.toggle('hidden', sub !== 'problem' || !ds.timedRounds);

    if (sub === 'setup') {
      document.getElementById('bet-spread-preset').value = prefs.preset;
      document.getElementById('bet-spread-scenario').value = prefs.scenario;
      document.getElementById('bet-spread-rounds').value = String(prefs.roundSize);
      document.getElementById('bet-spread-system').value = prefs.countingSystem || 'hi-lo';
      document.getElementById('bet-spread-bankroll').value = String(prefs.bankroll || BET_SPREAD_DEFAULT_BANKROLL);
      document.getElementById('bet-spread-show-kelly').checked = prefs.showKelly !== false;
      document.getElementById('bet-spread-heat-sim').checked = prefs.heatSim !== false;
      document.getElementById('bet-spread-timed').checked = !!prefs.timedRounds;
      document.getElementById('bet-spread-min-units').value = String(prefs.customMinUnits || 1);
      document.getElementById('bet-spread-max-units').value = String(prefs.customMaxUnits || 8);
      document.getElementById('bet-spread-custom-range')?.classList.toggle('hidden', prefs.preset !== 'custom');
      const range = resolveBetSpreadRange(prefs);
      document.getElementById('bet-spread-tagline').textContent =
        `${range.label} · ${BET_SPREAD_SCENARIOS[prefs.scenario]?.desc || ''}`;
    }

    if (sub === 'problem' && ds.currentProblem) {
      const p = ds.currentProblem;
      const scenarioLabel = BET_SPREAD_SCENARIOS[ds.scenario]?.label || 'Practice';
      const sysTag = p.countingSystem === 'ko' ? 'KO' : 'Hi-Lo';
      document.getElementById('bet-spread-progress').textContent =
        `Round ${ds.roundIndex + 1} of ${ds.roundSize} · ${scenarioLabel} · ${sysTag}`;
      const badge = document.getElementById('bet-spread-scenario-badge');
      const classLabels = { low: 'Low count', neutral: 'Neutral', high: 'High count' };
      badge.textContent = classLabels[p.scenarioClass] || 'Count';
      badge.className = `inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
        p.scenarioClass === 'high' ? 'bg-amber-950/50 border-amber-600/40 text-amber-200'
          : p.scenarioClass === 'low' ? 'bg-slate-800/50 border-slate-600/40 text-slate-300'
          : 'bg-black/30 border-white/10 text-cyan-300/90'}`;
      document.getElementById('bet-spread-rc').textContent = formatRunningCountDisplay(p.runningCount);
      document.getElementById('bet-spread-decks').textContent = String(p.decksRemaining);
      const countLabel = document.getElementById('bet-spread-count-label');
      const koPivotEl = document.getElementById('bet-spread-ko-pivot');
      if (p.countingSystem === 'ko') {
        countLabel.textContent = 'Running Count (bet metric)';
        document.getElementById('bet-spread-tc').textContent = formatRunningCountDisplay(p.runningCount);
        koPivotEl.classList.remove('hidden');
        koPivotEl.textContent = `Key count +${p.pivot} · ${p.abovePivot >= 0 ? '+' : ''}${p.abovePivot} above key → ${p.optimalUnits}u`;
      } else {
        countLabel.textContent = 'True Count';
        document.getElementById('bet-spread-tc').textContent = formatTrueCountAnswer(p.trueCount, 'decimal');
        koPivotEl.classList.add('hidden');
      }
      const safeLimit = Math.floor(p.bankroll * BET_SPREAD_SAFE_BR_FRACTION);
      document.getElementById('bet-spread-unit-hint').textContent =
        `$${p.unitSize}/unit · ${ds.minUnits}–${ds.maxUnits}u spread · bankroll $${p.bankroll.toLocaleString()} · safe bet ≤ $${safeLimit} (2%)`;
      const kellyEl = document.getElementById('bet-spread-kelly-overlay');
      if (ds.showKelly && kellyEl) {
        kellyEl.classList.remove('hidden');
        const edgePct = Math.round(estimatePlayerEdgeFraction(p.trueCount) * 1000) / 10;
        kellyEl.innerHTML = `½-Kelly reference: <strong>${p.kellyUnits} units</strong> ($${p.kellyUnits * p.unitSize})`
          + (edgePct > 0 ? ` · est. edge ~${edgePct}%` : ' · no edge at this count')
          + ' — educational only; drill answer uses the linear spread.';
      } else kellyEl?.classList.add('hidden');
      const brWarn = document.getElementById('bet-spread-bankroll-warn');
      if (brWarn) {
        brWarn.classList.remove('hidden');
        brWarn.textContent = `Risk of ruin guard: keep any single bet ≤ $${safeLimit} (${p.bankrollStress.safePct}% of $${p.bankroll.toLocaleString()} bankroll).`;
      }
      const heatHint = document.getElementById('bet-spread-heat-hint');
      if (heatHint) {
        if (ds.heatSim && ds.lastChosenUnits != null) {
          heatHint.classList.remove('hidden');
          heatHint.textContent = `Last bet: ${ds.lastChosenUnits}u — avoid jumps of ${BET_SPREAD_HEAT_JUMP_THRESHOLD}+ units (pit heat).`;
        } else heatHint.classList.add('hidden');
      }
      const btns = document.getElementById('bet-spread-unit-buttons');
      if (btns) {
        const safeLimitU = Math.floor(safeLimit / p.unitSize);
        btns.innerHTML = Array.from({ length: ds.maxUnits - ds.minUnits + 1 }, (_, i) => {
          const u = ds.minUnits + i;
          const amt = u * p.unitSize;
          const stressed = amt > safeLimit;
          const isMin = u === ds.minUnits;
          let cls = isMin ? 'bg-emerald-700 hover:bg-emerald-600'
            : u >= ds.maxUnits - 1 ? 'bg-amber-500 text-stone-900 hover:brightness-110'
            : 'bg-red-800 hover:bg-red-700';
          if (stressed) cls += ' ring-2 ring-orange-500/60';
          return `<button type="button" class="bet-spread-unit px-4 py-3 rounded-xl font-bold min-w-[4.5rem] ${cls} active:scale-95 transition" data-bet-units="${u}">${u}u<br><span class="text-[10px] font-mono opacity-80">$${amt}</span>${stressed ? '<br><span class="text-[9px] text-orange-300">⚠ 2% BR</span>' : ''}</button>`;
        }).join('');
        btns.querySelectorAll('[data-bet-units]').forEach(btn => {
          btn.onclick = () => this.submitBetSpreadChoice(parseInt(btn.dataset.betUnits, 10));
        });
      }
      document.getElementById('bet-spread-feedback')?.classList.add('hidden');
    }

    if (sub === 'summary') {
      const sum = summarizeBetSpreadRounds(ds.roundResults || []);
      const rampLine = sum.rampScore != null
        ? `<p class="text-xs text-emerald-300/80">Spread ramp: <strong>${sum.avgChosenLow}u</strong> low true count → <strong>${sum.avgChosenHigh}u</strong> high true count ${sum.rampScore >= 100 ? '✓' : '— ramp up with count!'}</p>`
        : '';
      const extras = [
        sum.heatFlags ? `${sum.heatFlags} heat flag${sum.heatFlags === 1 ? '' : 's'}` : '',
        sum.timedMisses ? `${sum.timedMisses} timeout${sum.timedMisses === 1 ? '' : 's'}` : '',
        sum.bankrollWarnings ? `${sum.bankrollWarnings} over 2% BR` : '',
      ].filter(Boolean).join(' · ');
      document.getElementById('bet-spread-summary').innerHTML = `
        <h3 class="font-bold text-gold text-lg">Session complete</h3>
        <p class="text-emerald-200/90">${sum.accuracy}% appropriate · ${sum.exactPct}% exact · avg ${sum.avgUnitError}u off</p>
        <p class="text-xs text-emerald-400/60">${ds.rangeLabel || BET_SPREAD_PRESETS[ds.preset]?.label} · ${BET_SPREAD_SCENARIOS[ds.scenario]?.label}${ds.countingSystem === 'ko' ? ' · KO' : ''}</p>
        ${extras ? `<p class="text-xs text-orange-300/80">${extras}</p>` : ''}
        ${rampLine}
        <div class="flex gap-2 justify-center pt-2">
          <button type="button" id="btn-bet-spread-again" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-bold">Another Session</button>
          <button type="button" id="btn-bet-spread-settings" class="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15">Change Settings</button>
        </div>`;
      document.getElementById('bet-spread-chart').innerHTML =
        renderBetSpreadSessionChartHtml(ds.roundResults || [], ds.maxUnits || 6);
      document.getElementById('btn-bet-spread-again')?.addEventListener('click', () => this.startBetSpreadDrillRound());
      document.getElementById('btn-bet-spread-settings')?.addEventListener('click', () => {
        this.betSpreadClearTimer();
        this.drillState = { subPhase: 'setup' };
        this.renderBetSpreadDrill();
      });
    }

    this.renderBetSpreadDrillStatsPanel();
  }

  openIndexPlayDrill() {
    this.speedDrillCleanupTimer();
    this.save.sessionActive = false;
    this.save.sessionDrill = 'index-plays';
    this.indexPlayDrillVisit = [];
    const prefs = this.save.indexPlayDrill?.prefs || defaultIndexPlayDrillPrefs();
    this.drillState = {
      subPhase: 'setup',
      mode: prefs.mode,
      roundSize: prefs.roundSize,
      problemIndex: 0,
      roundResults: [],
      currentProblem: null,
    };
    this.phase = 'drill-index';
    this.help = new HelpSystem(this.stats.helpLevel, 'drill-index');
    this.persist();
    this.render();
  }

  readIndexPlayDrillPrefsFromUI() {
    const mode = document.getElementById('index-drill-mode')?.value || 'random';
    const roundSize = parseInt(document.getElementById('index-drill-rounds')?.value || '10', 10);
    return {
      mode: INDEX_PLAY_MODES[mode] ? mode : 'random',
      roundSize: INDEX_PLAY_ROUND_OPTIONS.includes(roundSize) ? roundSize : 10,
    };
  }

  startIndexPlayDrillRound() {
    this.markDrillSessionStart();
    const prefs = this.readIndexPlayDrillPrefsFromUI();
    this.indexPlayDrillVisit = this.indexPlayDrillVisit || [];
    this.drillState = {
      subPhase: 'problem',
      mode: prefs.mode,
      roundSize: prefs.roundSize,
      problemIndex: 0,
      roundResults: [],
      currentProblem: generateIndexPlayProblem(prefs.mode),
    };
    this.renderIndexPlayDrill();
  }

  submitIndexPlayAnswer(action) {
    const ds = this.drillState;
    if (!ds || ds.subPhase !== 'problem' || !ds.currentProblem) return;
    const prob = ds.currentProblem;
    const correct = getIndexPlayCorrectAction(prob.play, prob.trueCount);
    const ok = action === correct.action;
    const result = {
      playId: prob.play.id,
      playName: prob.play.name,
      trueCount: prob.trueCount,
      index: prob.play.index,
      chosen: action,
      correct: ok,
      optimal: correct.action,
      explanation: correct.explanation,
    };
    ds.roundResults.push(result);
    this.indexPlayDrillVisit.push(result);

    const feedback = document.getElementById('index-drill-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.className = `rounded-xl px-4 py-3 text-sm ${ok
        ? 'bg-green-950/50 border border-green-600/40 text-green-200'
        : 'bg-red-950/40 border border-red-700/30 text-red-100'}`;
      if (ok) {
        feedback.innerHTML = `<strong>✓ Correct — ${formatIndexPlayAction(action)}</strong><br><span class="text-emerald-200/85">${correct.summary}. ${correct.explanation}</span>`;
      } else {
        feedback.innerHTML = `<strong>✗ ${formatIndexPlayAction(action)} — optimal: ${formatIndexPlayAction(correct.action)}</strong><br><span class="text-red-100/90">${correct.summary}. ${correct.explanation}</span>`;
      }
    }
    if (ok) Sounds.play('count');
    else Sounds.play('loss');

    if (!ok) {
      recordMistakeReviewEntry(this.save, {
        drillId: 'index-plays',
        category: 'deviation',
        context: `${prob.play.name} at true count ${formatTrueCountAnswer(prob.trueCount, 'decimal')}`,
        wrong: formatIndexPlayAction(action),
        correct: formatIndexPlayAction(correct.action),
        detail: correct.explanation,
        meta: { playId: prob.play.id, trueCount: prob.trueCount, index: prob.play.index },
      });
    }

    ds.problemIndex++;
    if (ds.problemIndex >= ds.roundSize) {
      const sum = summarizeIndexPlayRounds(ds.roundResults);
      this.checkDailyTrainingProgress('drillSession', {
        drillId: 'index-plays',
        accuracy: sum.accuracy,
        attempts: sum.total,
      });
      const correctCount = ds.roundResults.filter(r => r.correct).length;
      recordIndexPlayDrillSession(this.save, {
        mode: ds.mode,
        roundSize: ds.roundSize,
        accuracy: sum.accuracy,
        correct: correctCount,
        total: sum.total,
      });
      recordTrainingHistorySession(this.save, 'index-plays', {
        attempts: sum.total,
        accuracy: sum.accuracy,
        avgError: sum.avgError,
        meta: { mode: ds.mode, roundSize: ds.roundSize },
      });
      this.persist();
      setTimeout(() => {
        this.finishDrillWithSummary('index-plays', {
          rounds: ds.roundResults,
          sum,
          meta: { mode: ds.mode, roundSize: ds.roundSize },
          subtitle: `${INDEX_PLAY_MODES[ds.mode]?.label || ds.mode} · ${sum.total} problems`,
        });
      }, ok ? 900 : 1400);
      return;
    }
    setTimeout(() => {
      ds.currentProblem = generateIndexPlayProblem(ds.mode);
      feedback?.classList.add('hidden');
      this.renderIndexPlayDrill();
    }, ok ? 750 : 1200);
  }

  renderIndexPlayDrillStatsPanel() {
    const el = document.getElementById('index-drill-stats');
    if (!el) return;
    const visit = summarizeIndexPlayRounds(this.indexPlayDrillVisit || []);
    const lifetime = summarizeIndexPlayRounds(
      (this.save.indexPlayDrill?.sessions || []).flatMap(s =>
        Array.from({ length: s.total }, (_, i) => ({ correct: i < s.correct }))
      )
    );
    const sessionBlock = visit.total
      ? `<div class="mb-3 pb-3 border-b border-white/10">
          <p class="text-xs uppercase tracking-wider text-cyan-400/80 mb-2 text-center">This session</p>
          <div class="grid grid-cols-2 gap-2 text-center text-xs">
            <div class="rounded-lg bg-cyan-950/30 p-2 border border-cyan-800/25">
              <div class="text-emerald-400/70">Accuracy</div>
              <div class="font-bold text-lg text-cyan-200">${visit.accuracy}%</div>
            </div>
            <div class="rounded-lg bg-cyan-950/30 p-2 border border-cyan-800/25">
              <div class="text-emerald-400/70">Problems</div>
              <div class="font-bold text-lg text-cyan-200">${visit.total}</div>
            </div>
          </div>
        </div>`
      : '';
    const sessions = this.save.indexPlayDrill?.sessions || [];
    const lifetimeAcc = sessions.length
      ? Math.round(sessions.reduce((a, s) => a + s.accuracy, 0) / sessions.length)
      : 0;
    const lifetimeBlock = sessions.length
      ? `<p class="text-xs uppercase tracking-wider text-amber-400/80 mb-2 text-center">All time</p>
         <div class="grid grid-cols-2 gap-2 text-center text-xs">
           <div class="rounded-lg bg-black/30 p-2"><div class="text-emerald-400/70">Avg accuracy</div><div class="font-bold text-lg text-emerald-200">${lifetimeAcc}%</div></div>
           <div class="rounded-lg bg-black/30 p-2"><div class="text-emerald-400/70">Rounds saved</div><div class="font-bold text-lg text-emerald-200">${sessions.length}</div></div>
         </div>`
      : '<p class="text-emerald-400/60 text-center text-xs">Start a round to track index play accuracy.</p>';
    el.innerHTML = sessionBlock + lifetimeBlock;
  }

  renderIndexPlayDrill() {
    const ds = this.drillState || { subPhase: 'setup' };
    const prefs = this.save.indexPlayDrill?.prefs || defaultIndexPlayDrillPrefs();
    const sub = ds.subPhase || 'setup';

    document.getElementById('index-drill-setup')?.classList.toggle('hidden', sub !== 'setup');
    document.getElementById('index-drill-active')?.classList.toggle('hidden', sub !== 'problem');
    document.getElementById('index-drill-summary')?.classList.toggle('hidden', sub !== 'summary');

    if (sub === 'setup') {
      const modeSel = document.getElementById('index-drill-mode');
      const roundsSel = document.getElementById('index-drill-rounds');
      if (modeSel) modeSel.value = prefs.mode;
      if (roundsSel) roundsSel.value = String(prefs.roundSize);
      const modeLabel = INDEX_PLAY_MODES[prefs.mode]?.label || 'Random Mix';
      document.getElementById('index-drill-tagline').textContent =
        `${INDEX_PLAY_CATALOG.length} index plays · ${modeLabel}`;
    }

    if (sub === 'problem' && ds.currentProblem) {
      const { play, trueCount } = ds.currentProblem;
      const hand = handFromRanks(play.playerRanks);
      const dealerCard = createPlayingCard(play.dealerUp, 'S');
      document.getElementById('index-drill-progress').textContent =
        `Problem ${ds.problemIndex + 1} of ${ds.roundSize} · ${INDEX_PLAY_MODES[ds.mode]?.label || 'Drill'}`;
      document.getElementById('index-drill-scenario').textContent = play.name;
      document.getElementById('index-drill-hand').innerHTML = play.category === 'insurance'
        ? '<span class="text-emerald-200/80 text-sm">Your hand (insurance decision)</span>'
        : hand.cards.map(c => this.renderCard(c)).join('');
      document.getElementById('index-drill-vs').textContent = play.category === 'insurance'
        ? 'Dealer shows Ace — insurance?'
        : `Your ${hand.value()} vs dealer`;
      document.getElementById('index-drill-dealer').innerHTML = this.renderCard(dealerCard);
      const tcFmt = formatTrueCountAnswer(trueCount, 'decimal');
      document.getElementById('index-drill-tc').textContent = tcFmt;
      const indexFmt = play.index >= 0 ? `+${play.index}` : `${play.index}`;
      document.getElementById('index-drill-prompt').textContent = play.category === 'insurance'
        ? `True count ${tcFmt} — take insurance? (index ${indexFmt})`
        : `True count ${tcFmt} — correct play? (index ${indexFmt})`;

      const actionsEl = document.getElementById('index-drill-actions');
      if (actionsEl) {
        const btns = play.category === 'insurance'
          ? [['no-insurance', 'No Insurance', 'bg-red-800'], ['insurance', 'Take Insurance', 'bg-amber-500 text-stone-900']]
          : [
            ['hit', 'Hit', 'bg-green-700'],
            ['stand', 'Stand', 'bg-red-800'],
            ...(play.canDouble || play.indexAction === 'double' || play.basicAction === 'double'
              ? [['double', 'Double', 'bg-amber-500 text-stone-900']] : []),
          ];
        actionsEl.innerHTML = btns.map(([a, label, cls]) =>
          `<button type="button" class="index-drill-action px-6 py-3 rounded-xl font-bold ${cls} hover:brightness-110 active:scale-95 transition" data-index-action="${a}">${label}</button>`
        ).join('');
        actionsEl.querySelectorAll('[data-index-action]').forEach(btn => {
          btn.onclick = () => this.submitIndexPlayAnswer(btn.dataset.indexAction);
        });
      }
      document.getElementById('index-drill-feedback')?.classList.add('hidden');
    }

    if (sub === 'summary') {
      const sum = summarizeIndexPlayRounds(ds.roundResults || []);
      const mistakes = (ds.roundResults || []).filter(r => !r.correct);
      const mistakeLines = mistakes.slice(0, 3).map(r =>
        `<li class="text-left text-xs text-red-200/90">• ${r.playName} at true count ${formatTrueCountAnswer(r.trueCount, 'decimal')}: chose ${formatIndexPlayAction(r.chosen)}, needed ${formatIndexPlayAction(r.optimal)}</li>`
      ).join('');
      document.getElementById('index-drill-summary').innerHTML = `
        <h3 class="font-bold text-gold text-lg">Round complete</h3>
        <p class="text-emerald-200/90">${sum.accuracy}% correct · ${sum.total} problems · ${INDEX_PLAY_MODES[ds.mode]?.label || ''}</p>
        ${mistakes.length ? `<ul class="mt-2 space-y-1 max-w-md mx-auto">${mistakeLines}</ul>` : '<p class="text-green-300 text-xs">Perfect round — all index plays correct!</p>'}
        <div class="flex gap-2 justify-center pt-2">
          <button type="button" id="btn-index-drill-again" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-bold">Another Round</button>
          <button type="button" id="btn-index-drill-settings" class="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15">Change Settings</button>
        </div>`;
      document.getElementById('btn-index-drill-again')?.addEventListener('click', () => this.startIndexPlayDrillRound());
      document.getElementById('btn-index-drill-settings')?.addEventListener('click', () => {
        this.drillState = { subPhase: 'setup' };
        this.renderIndexPlayDrill();
      });
    }

    this.renderIndexPlayDrillStatsPanel();
  }

  burstDrillCleanupTimer() {
    if (this._burstDrillTimer) {
      clearTimeout(this._burstDrillTimer);
      this._burstDrillTimer = null;
    }
  }

  openCardBurstDrill() {
    this.burstDrillCleanupTimer();
    this.save.sessionActive = false;
    this.save.sessionDrill = 'card-bursts';
    this.cardBurstVisit = [];
    this.drillState = { subPhase: 'setup' };
    this.phase = 'drill-card-burst';
    this.help = new HelpSystem(this.stats.helpLevel, 'card-bursts');
    this.persist();
    this.render();
  }

  readCardBurstPrefsFromUI() {
    const burstSize = parseInt(document.getElementById('burst-drill-size')?.value || '4', 10);
    const roundSize = parseInt(document.getElementById('burst-drill-rounds')?.value || '8', 10);
    const speed = document.getElementById('burst-drill-speed')?.value || 'normal';
    return {
      burstSize: CARD_BURST_SIZES.includes(burstSize) ? burstSize : 4,
      roundSize: CARD_BURST_ROUND_OPTIONS.includes(roundSize) ? roundSize : 8,
      speed: CARD_BURST_MS[speed] ? speed : 'normal',
    };
  }

  startCardBurstRound() {
    this.markDrillSessionStart();
    this.burstDrillCleanupTimer();
    const prefs = this.readCardBurstPrefsFromUI();
    this.shoe = new Shoe(2);
    this.counter = new CardCounter('hi-lo');
    this.counter.reset();
    this.cardBurstVisit = this.cardBurstVisit || [];
    this.drillState = {
      subPhase: 'active',
      burstSize: prefs.burstSize,
      roundSize: prefs.roundSize,
      speed: prefs.speed,
      burstIndex: 0,
      burstCards: [],
      roundResults: [],
      phase: 'burst',
    };
    Sounds.init();
    this.renderCardBurstDrill();
    this.scheduleCardBurstDeal();
  }

  scheduleCardBurstDeal() {
    const ds = this.drillState;
    if (!ds || ds.subPhase !== 'active' || ds.phase !== 'burst') return;
    const delay = CARD_BURST_MS[ds.speed] || CARD_BURST_MS.normal;
    this._burstDrillTimer = setTimeout(() => this.cardBurstDealNext(), delay);
  }

  cardBurstDealNext() {
    const ds = this.drillState;
    if (!ds || ds.subPhase !== 'active' || ds.phase !== 'burst') return;
    if (!this.shoe || this.shoe.cardsRemaining < 1) {
      this.cardBurstShowQuiz();
      return;
    }
    const card = this.shoe.deal();
    this.counter.recordCardRemovedFromShoe(card);
    ds.burstCards.push(card);
    Sounds.play('card');
    if (ds.burstCards.length >= ds.burstSize) {
      this.renderCardBurstDrill();
      this.cardBurstShowQuiz();
      return;
    }
    this.renderCardBurstDrill();
    this.scheduleCardBurstDeal();
  }

  cardBurstShowQuiz() {
    this.burstDrillCleanupTimer();
    const ds = this.drillState;
    if (!ds) return;
    ds.phase = 'quiz';
    this.renderCardBurstDrill();
    document.getElementById('burst-drill-guess')?.focus();
  }

  submitCardBurstGuess(rawGuess) {
    const ds = this.drillState;
    if (!ds || ds.phase !== 'quiz') return;
    const parsed = validateRunningCountGuess(rawGuess);
    if (!parsed.ok) {
      this.toast(parsed.error, 'error');
      return;
    }
    const guess = parsed.value;
    const actual = this.counter.runningCount;
    const error = Math.abs(guess - actual);
    const withinOne = error <= 1;
    const result = { guess, actual, error, withinOne, burstIndex: ds.burstIndex + 1 };
    ds.roundResults.push(result);
    this.cardBurstVisit.push(result);
    this.stats.countGuesses++;
    if (withinOne) this.stats.countCorrect++;
    if (!withinOne) {
      recordMistakeReviewEntry(this.save, {
        drillId: 'card-bursts',
        category: 'count',
        context: `Burst ${ds.burstIndex + 1} of ${ds.roundSize}`,
        wrong: fmtSignedCount(guess),
        correct: fmtSignedCount(actual),
        detail: `Off by ${error}`,
      });
    }
    this.persist();
    if (withinOne) Sounds.play('count');
    else Sounds.play('loss');
    const feedback = document.getElementById('burst-drill-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.className = `rounded-xl px-4 py-3 text-sm text-center font-medium ${withinOne ? 'bg-green-950/50 border border-green-600/40 text-green-300' : 'bg-red-950/40 border border-red-700/30 text-red-200'}`;
      feedback.textContent = withinOne
        ? `✓ Correct! Running count = ${fmtSignedCount(actual)}`
        : `✗ Actual = ${fmtSignedCount(actual)} (you said ${fmtSignedCount(guess)})`;
    }
    ds.burstIndex++;
    if (ds.burstIndex >= ds.roundSize) {
      const sum = summarizeCardBurstRounds(ds.roundResults);
      recordTrainingHistorySession(this.save, 'card-bursts', {
        attempts: sum.total,
        accuracy: sum.accuracy,
        avgError: sum.avgError,
        meta: { burstSize: ds.burstSize, roundSize: ds.roundSize },
      });
      setTimeout(() => {
        this.finishDrillWithSummary('card-bursts', {
          rounds: ds.roundResults,
          sum,
          subtitle: `${ds.burstSize}-card bursts · ${sum.total} rounds`,
        });
      }, 900);
      return;
    }
    ds.burstCards = [];
    ds.phase = 'burst';
    const quiz = document.getElementById('burst-drill-quiz');
    const fb = document.getElementById('burst-drill-feedback');
    quiz?.classList.add('hidden');
    fb?.classList.add('hidden');
    setTimeout(() => {
      this.renderCardBurstDrill();
      this.scheduleCardBurstDeal();
    }, 700);
  }

  renderCardBurstDrill() {
    const ds = this.drillState || {};
    const setup = document.getElementById('burst-drill-setup');
    const active = document.getElementById('burst-drill-active');
    const isSetup = ds.subPhase === 'setup' || !ds.subPhase;
    setup?.classList.toggle('hidden', !isSetup);
    active?.classList.toggle('hidden', isSetup);
    if (isSetup) return;
    const prog = document.getElementById('burst-drill-progress');
    if (prog) prog.textContent = `Burst ${Math.min(ds.burstIndex + 1, ds.roundSize)} / ${ds.roundSize}`;
    const area = document.getElementById('burst-drill-card-area');
    if (area) {
      area.innerHTML = (ds.burstCards || []).map(c => {
        const red = c.suit === 'H' || c.suit === 'D';
        return `<span class="inline-flex items-center justify-center w-10 h-14 rounded-md bg-white text-sm font-bold shadow ${red ? 'text-red-600' : 'text-gray-900'}">${c.rank}</span>`;
      }).join('') || '<span class="text-emerald-500/50 text-sm">Dealing burst…</span>';
    }
    const prompt = document.getElementById('burst-drill-prompt');
    const quiz = document.getElementById('burst-drill-quiz');
    const showQuiz = ds.phase === 'quiz';
    prompt?.classList.toggle('hidden', !showQuiz);
    quiz?.classList.toggle('hidden', !showQuiz);
    const stats = document.getElementById('burst-drill-stats');
    if (stats) {
      const sum = summarizeCardBurstRounds(this.cardBurstVisit || []);
      stats.innerHTML = sum.total
        ? `<p class="text-xs uppercase text-cyan-400/70 mb-1">Session</p><p>${sum.accuracy}% accuracy · ${sum.total} burst${sum.total === 1 ? '' : 's'} · avg error ${sum.avgError}</p>`
        : '<p class="text-emerald-500/60 text-center">Complete a round to log stats.</p>';
    }
  }

  openDecksLeftDrill() {
    this.save.sessionActive = false;
    this.save.sessionDrill = 'decks-left';
    this.decksLeftVisit = [];
    const prefs = this.save.decksLeftDrill?.prefs || defaultDecksLeftDrillStats().prefs;
    this.drillState = { subPhase: 'setup', numDecks: prefs.numDecks, roundSize: prefs.roundSize, tolerance: prefs.tolerance };
    this.phase = 'drill-decks-left';
    this.help = new HelpSystem(this.stats.helpLevel, 'decks-left');
    this.persist();
    this.render();
  }

  readDecksLeftPrefsFromUI() {
    const numDecks = parseInt(document.getElementById('decks-drill-shoe')?.value || '6', 10);
    const roundSize = parseInt(document.getElementById('decks-drill-rounds')?.value || '8', 10);
    const tolerance = parseFloat(document.getElementById('decks-drill-tolerance')?.value || '0.25');
    return {
      numDecks: DECKS_LEFT_SHOE_OPTIONS.includes(numDecks) ? numDecks : 6,
      roundSize: DECKS_LEFT_ROUND_OPTIONS.includes(roundSize) ? roundSize : 8,
      tolerance: DECKS_LEFT_TOLERANCE_OPTIONS.includes(tolerance) ? tolerance : 0.25,
    };
  }

  startDecksLeftRound() {
    this.markDrillSessionStart();
    const prefs = this.readDecksLeftPrefsFromUI();
    this.decksLeftVisit = this.decksLeftVisit || [];
    this.drillState = {
      subPhase: 'problem',
      numDecks: prefs.numDecks,
      roundSize: prefs.roundSize,
      tolerance: prefs.tolerance,
      problemIndex: 0,
      roundResults: [],
      currentProblem: generateDecksLeftProblem(prefs.numDecks),
    };
    if (!this.save.decksLeftDrill) this.save.decksLeftDrill = defaultDecksLeftDrillStats();
    this.save.decksLeftDrill.prefs = prefs;
    this.renderDecksLeftDrill();
    document.getElementById('decks-drill-guess')?.focus();
  }

  submitDecksLeftGuess(rawGuess) {
    const ds = this.drillState;
    if (!ds || ds.subPhase !== 'problem' || !ds.currentProblem) return;
    const prob = ds.currentProblem;
    const check = validateDecksLeftGuess(rawGuess, prob.decksRemaining, ds.tolerance);
    if (!check.ok) {
      this.toast(check.error, 'error');
      return;
    }
    const result = {
      numDecks: prob.numDecks,
      cardsDealt: prob.cardsDealt,
      runningCount: prob.runningCount,
      guess: check.value,
      actual: prob.decksRemaining,
      error: check.error,
      correct: check.correct,
      tolerance: ds.tolerance,
    };
    ds.roundResults.push(result);
    this.decksLeftVisit.push(result);
    this.stats.countGuesses++;
    if (check.correct) this.stats.countCorrect++;
    if (!check.correct) {
      recordMistakeReviewEntry(this.save, {
        drillId: 'decks-left',
        category: 'count',
        context: `${prob.numDecks}-deck shoe · ${prob.cardsDealt} cards dealt`,
        wrong: `${check.value}`,
        correct: `${prob.decksRemaining}`,
        detail: `Off by ${check.error} decks`,
      });
    }
    this.persist();
    if (check.correct) Sounds.play('count');
    else Sounds.play('loss');
    const feedback = document.getElementById('decks-drill-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      feedback.className = `rounded-xl px-4 py-3 text-sm text-center font-medium ${check.correct ? 'bg-green-950/50 border border-green-600/40 text-green-300' : 'bg-red-950/40 border border-red-700/30 text-red-200'}`;
      feedback.textContent = check.correct
        ? `✓ Correct! ${prob.decksRemaining} decks remaining`
        : `✗ Actual = ${prob.decksRemaining} decks (you said ${check.value})`;
    }
    ds.problemIndex++;
    if (ds.problemIndex >= ds.roundSize) {
      const sum = summarizeDecksLeftRounds(ds.roundResults);
      recordTrainingHistorySession(this.save, 'decks-left', {
        attempts: sum.total,
        accuracy: sum.accuracy,
        avgError: sum.avgError,
        meta: { numDecks: ds.numDecks, tolerance: ds.tolerance },
      });
      setTimeout(() => {
        this.finishDrillWithSummary('decks-left', {
          rounds: ds.roundResults,
          sum,
          meta: { numDecks: ds.numDecks, tolerance: ds.tolerance },
          subtitle: `${ds.numDecks}-deck shoe · ±${ds.tolerance} decks`,
        });
      }, 900);
      return;
    }
    ds.currentProblem = generateDecksLeftProblem(ds.numDecks);
    setTimeout(() => {
      const fb = document.getElementById('decks-drill-feedback');
      fb?.classList.add('hidden');
      this.renderDecksLeftDrill();
      document.getElementById('decks-drill-guess')?.focus();
    }, 700);
  }

  renderDecksLeftDrill() {
    const ds = this.drillState || {};
    const setup = document.getElementById('decks-drill-setup');
    const active = document.getElementById('decks-drill-active');
    const isSetup = ds.subPhase === 'setup' || !ds.subPhase;
    setup?.classList.toggle('hidden', !isSetup);
    active?.classList.toggle('hidden', isSetup);
    if (isSetup) {
      const prefs = this.save.decksLeftDrill?.prefs;
      if (prefs) {
        document.getElementById('decks-drill-shoe').value = String(prefs.numDecks);
        document.getElementById('decks-drill-rounds').value = String(prefs.roundSize);
        document.getElementById('decks-drill-tolerance').value = String(prefs.tolerance);
      }
      return;
    }
    const prog = document.getElementById('decks-drill-progress');
    if (prog) prog.textContent = `Problem ${Math.min(ds.problemIndex + 1, ds.roundSize)} / ${ds.roundSize}`;
    const prob = ds.currentProblem;
    if (prob) {
      document.getElementById('decks-drill-dealt').textContent = String(prob.cardsDealt);
      document.getElementById('decks-drill-rc').textContent = fmtSignedCount(prob.runningCount);
      document.getElementById('decks-drill-shoe-label').textContent =
        `Shoe started with ${prob.numDecks} decks (${prob.numDecks * 52} cards)`;
    }
    const guessEl = document.getElementById('decks-drill-guess');
    if (guessEl && ds.phase !== 'feedback') guessEl.value = '';
    const stats = document.getElementById('decks-drill-stats');
    if (stats) {
      const sum = summarizeDecksLeftRounds(this.decksLeftVisit || []);
      stats.innerHTML = sum.total
        ? `<p class="text-xs uppercase text-cyan-400/70 mb-1">Session</p><p>${sum.accuracy}% accuracy · ${sum.total} problem${sum.total === 1 ? '' : 's'} · avg error ${sum.avgError}</p>`
        : '<p class="text-emerald-500/60 text-center">Complete a round to log stats.</p>';
    }
  }

  openTrueCountDrill() {
    this.speedDrillCleanupTimer();
    this.save.sessionActive = false;
    this.save.sessionDrill = 'true-count';
    this.trueCountDrillVisit = [];
    const prefs = this.save.trueCountDrill?.prefs || defaultTrueCountDrillPrefs();
    this.drillState = {
      subPhase: 'setup',
      difficulty: prefs.difficulty,
      roundSize: prefs.roundSize,
      problemIndex: 0,
      roundResults: [],
      currentProblem: null,
    };
    this.phase = 'drill-true-count';
    this.help = new HelpSystem(this.stats.helpLevel, 'drill-true-count');
    this.persist();
    this.render();
  }

  readTrueCountDrillPrefsFromUI() {
    const difficulty = document.getElementById('tc-drill-difficulty')?.value || 'decimal';
    const roundSize = parseInt(document.getElementById('tc-drill-rounds')?.value || '10', 10);
    return {
      difficulty: TC_DRILL_DIFFICULTIES[difficulty] ? difficulty : 'decimal',
      roundSize: TC_DRILL_ROUND_OPTIONS.includes(roundSize) ? roundSize : 10,
    };
  }

  startTrueCountDrillRound() {
    this.markDrillSessionStart();
    const prefs = this.readTrueCountDrillPrefsFromUI();
    this.trueCountDrillVisit = this.trueCountDrillVisit || [];
    this.drillState = {
      subPhase: 'problem',
      difficulty: prefs.difficulty,
      roundSize: prefs.roundSize,
      problemIndex: 0,
      roundResults: [],
      currentProblem: generateTrueCountProblem(prefs.difficulty),
    };
    this.renderTrueCountDrill();
    document.getElementById('tc-drill-guess')?.focus();
  }

  submitTrueCountDrillGuess(rawGuess) {
    const ds = this.drillState;
    if (!ds || ds.subPhase !== 'problem' || !ds.currentProblem) return;
    const parsed = validateTrueCountGuessInput(rawGuess, ds.difficulty);
    if (!parsed.ok) {
      this.toast(parsed.error, 'error');
      return;
    }
    const guess = parsed.value;
    const prob = ds.currentProblem;
    const actual = prob.trueCount;
    const error = Math.round(Math.abs(guess - actual) * 100) / 100;
    const correct = isTrueCountGuessCorrect(guess, actual, ds.difficulty);
    const result = {
      difficulty: ds.difficulty,
      roundSize: ds.roundSize,
      runningCount: prob.runningCount,
      decksRemaining: prob.decksRemaining,
      trueCount: actual,
      guess,
      error,
      correct,
    };
    ds.roundResults.push(result);
    this.trueCountDrillVisit.push(result);
    recordTrueCountDrillRound(this.save, result);
    this.stats.countGuesses++;
    if (correct) this.stats.countCorrect++;
    this.persist();
    if (correct) Sounds.play('count');
    else Sounds.play('loss');

    if (!correct) {
      recordMistakeReviewEntry(this.save, {
        drillId: 'true-count',
        category: 'count',
        context: `Running count ${fmtSignedCount(prob.runningCount)} ÷ ${prob.decksRemaining} deck${prob.decksRemaining === 1 ? '' : 's'}`,
        wrong: formatTrueCountAnswer(guess, ds.difficulty),
        correct: formatTrueCountAnswer(actual, ds.difficulty),
        detail: `Off by ${error}`,
        meta: { runningCount: prob.runningCount, decksRemaining: prob.decksRemaining, guess, actual, error },
      });
    }

    const feedback = document.getElementById('tc-drill-feedback');
    if (feedback) {
      feedback.classList.remove('hidden');
      const ans = formatTrueCountAnswer(actual, ds.difficulty);
      const guessFmt = formatTrueCountAnswer(guess, ds.difficulty);
      feedback.className = `rounded-xl px-4 py-3 text-sm text-center font-medium ${correct ? 'bg-green-950/50 border border-green-600/40 text-green-300' : 'bg-red-950/40 border border-red-700/30 text-red-200'}`;
      feedback.textContent = correct
        ? `✓ Correct! True count = ${ans}`
        : `✗ Actual true count = ${ans} (you said ${guessFmt}, off by ${error})`;
    }

    ds.problemIndex++;
    if (ds.problemIndex >= ds.roundSize) {
      const sum = summarizeTrueCountDrillRounds(ds.roundResults || []);
      this.checkDailyTrainingProgress('drillSession', {
        drillId: 'true-count',
        accuracy: sum.accuracy,
        attempts: sum.total,
      });
      recordTrainingHistorySession(this.save, 'true-count', {
        attempts: sum.total,
        accuracy: sum.accuracy,
        avgError: sum.avgError,
        meta: { difficulty: ds.difficulty, roundSize: ds.roundSize },
      });
      setTimeout(() => {
        this.finishDrillWithSummary('true-count', {
          rounds: ds.roundResults,
          sum,
          meta: { difficulty: ds.difficulty, roundSize: ds.roundSize },
          subtitle: `${TC_DRILL_DIFFICULTIES[ds.difficulty]?.label || ds.difficulty} · ${sum.total} problems`,
        });
      }, correct ? 650 : 1100);
      return;
    }
    setTimeout(() => {
      ds.currentProblem = generateTrueCountProblem(ds.difficulty);
      const input = document.getElementById('tc-drill-guess');
      if (input) input.value = '';
      if (feedback) feedback.classList.add('hidden');
      this.renderTrueCountDrill();
      input?.focus();
    }, correct ? 550 : 950);
  }

  renderTrueCountDrillStatsPanel() {
    const el = document.getElementById('tc-drill-stats');
    if (!el) return;
    const visit = summarizeTrueCountDrillRounds(this.trueCountDrillVisit || []);
    const lifetime = summarizeTrueCountDrillRounds(
      (this.save.trueCountDrill?.sessions || []).map(s => ({ correct: s.correct, error: s.error }))
    );
    const sessionBlock = visit.total
      ? `<div class="mb-3 pb-3 border-b border-white/10">
          <p class="text-xs uppercase tracking-wider text-cyan-400/80 mb-2 text-center">This session</p>
          <div class="grid grid-cols-2 gap-2 text-center text-xs">
            <div class="rounded-lg bg-cyan-950/30 p-2 border border-cyan-800/25">
              <div class="text-emerald-400/70">Accuracy</div>
              <div class="font-bold text-lg text-cyan-200">${visit.accuracy}%</div>
            </div>
            <div class="rounded-lg bg-cyan-950/30 p-2 border border-cyan-800/25">
              <div class="text-emerald-400/70">Avg error</div>
              <div class="font-bold text-lg text-cyan-200">${visit.avgError}</div>
            </div>
          </div>
          <p class="text-[10px] text-emerald-500/50 text-center mt-1">${visit.total} attempt${visit.total === 1 ? '' : 's'}</p>
        </div>`
      : '';
    const lifetimeBlock = lifetime.total
      ? `<p class="text-xs uppercase tracking-wider text-amber-400/80 mb-2 text-center">All time</p>
         <div class="grid grid-cols-2 gap-2 text-center text-xs">
           <div class="rounded-lg bg-black/30 p-2"><div class="text-emerald-400/70">Accuracy</div><div class="font-bold text-lg text-emerald-200">${lifetime.accuracy}%</div></div>
           <div class="rounded-lg bg-black/30 p-2"><div class="text-emerald-400/70">Avg error</div><div class="font-bold text-lg text-emerald-200">${lifetime.avgError}</div></div>
         </div>
         <p class="text-[10px] text-emerald-500/50 text-center mt-2">${lifetime.total} problems saved</p>`
      : '<p class="text-emerald-400/60 text-center text-xs">Start a round to track accuracy.</p>';
    el.innerHTML = sessionBlock + lifetimeBlock;
  }

  renderTrueCountDrill() {
    const ds = this.drillState || { subPhase: 'setup' };
    const prefs = this.save.trueCountDrill?.prefs || defaultTrueCountDrillPrefs();
    const sub = ds.subPhase || 'setup';

    document.getElementById('tc-drill-setup')?.classList.toggle('hidden', sub !== 'setup');
    document.getElementById('tc-drill-active')?.classList.toggle('hidden', sub !== 'problem');
    document.getElementById('tc-drill-summary')?.classList.toggle('hidden', sub !== 'summary');

    if (sub === 'setup') {
      const diffSel = document.getElementById('tc-drill-difficulty');
      const roundsSel = document.getElementById('tc-drill-rounds');
      if (diffSel) diffSel.value = prefs.difficulty;
      if (roundsSel) roundsSel.value = String(prefs.roundSize);
      const cfg = TC_DRILL_DIFFICULTIES[prefs.difficulty];
      document.getElementById('tc-drill-tagline').textContent =
        cfg ? `${cfg.label} — ${cfg.hint}` : 'Running count ÷ decks left';
    }

    if (sub === 'problem' && ds.currentProblem) {
      const p = ds.currentProblem;
      document.getElementById('tc-drill-progress').textContent =
        `Problem ${ds.problemIndex + 1} of ${ds.roundSize} · ${TC_DRILL_DIFFICULTIES[ds.difficulty]?.label || 'Drill'}`;
      document.getElementById('tc-drill-rc').textContent = formatRunningCountDisplay(p.runningCount);
      document.getElementById('tc-drill-decks').textContent = String(p.decksRemaining);
      document.getElementById('tc-drill-formula').textContent =
        `${formatRunningCountDisplay(p.runningCount)} ÷ ${p.decksRemaining} = ?`;
      document.getElementById('tc-drill-feedback')?.classList.add('hidden');
      const input = document.getElementById('tc-drill-guess');
      if (input && document.activeElement !== input) input.placeholder = ds.difficulty === 'whole' ? '0' : '0.0';
    }

    if (sub === 'summary') {
      const sum = summarizeTrueCountDrillRounds(ds.roundResults || []);
      const diffLabel = TC_DRILL_DIFFICULTIES[ds.difficulty]?.label || ds.difficulty;
      document.getElementById('tc-drill-summary').innerHTML = `
        <h3 class="font-bold text-gold text-lg">Round complete</h3>
        <p class="text-emerald-200/90">${sum.accuracy}% correct · avg error ${sum.avgError} · ${diffLabel}</p>
        <p class="text-xs text-emerald-400/60">${sum.total} problems · true count = running count ÷ decks remaining</p>
        <div class="flex gap-2 justify-center pt-2">
          <button type="button" id="btn-tc-drill-again" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-bold">Another Round</button>
          <button type="button" id="btn-tc-drill-settings" class="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15">Change Settings</button>
        </div>`;
      document.getElementById('btn-tc-drill-again')?.addEventListener('click', () => this.startTrueCountDrillRound());
      document.getElementById('btn-tc-drill-settings')?.addEventListener('click', () => {
        this.drillState = { subPhase: 'setup' };
        this.renderTrueCountDrill();
      });
    }

    this.renderTrueCountDrillStatsPanel();
  }

  drillCountDeal() {
    if (!this.shoe || this.shoe.cardsRemaining < 5) {
      this.toast('Shoe ending — take the quiz!', 'info');
      return;
    }
    const c = this.shoe.deal();
    this.counter.recordCardRemovedFromShoe(c);
    this.help.recordRunningCountSnapshot(this.counter.runningCount);
    this.drillState.cardsDealt++;
    Sounds.play('card');
    this.renderDrillCount(c);
  }

  drillCountFinish() {
    this.resetCountQuizModal();
    this._afterCountQuiz = null;
    document.getElementById('modal-count-quiz').showModal();
    document.getElementById('count-quiz-input').value = '';
    document.querySelector('#modal-count-quiz h3').textContent = 'Final Running Count Quiz';
    document.querySelector('#modal-count-quiz > p').textContent =
      `You dealt ${this.drillState?.cardsDealt || 0} cards. What is the final running count for this deck round? (±1 counts as correct.)`;
    this.drillState.quizPending = true;
  }

  submitDrillCountQuiz(rawGuess) {
    const parsed = validateRunningCountGuess(rawGuess, this.shoe);
    if (!parsed.ok) {
      this.showFieldError('count-quiz-result', parsed.error);
      this.toast(parsed.error, 'error');
      return;
    }
    const playerGuess = parsed.value;
    const actualRunningCount = this.counter.runningCount;
    const ok = Math.abs(playerGuess - actualRunningCount) <= 1;
    this.stats.countGuesses++;
    if (ok) this.stats.countCorrect++;
    this.help.shoeGuesses++; if (ok) this.help.shoeCorrect++;
    if (ok) Sounds.play('count');
    const report = {
      num: this.help.shoeNum, hands: 0, guesses: 1, correct: ok ? 1 : 0, mistakes: 0,
      countSamples: [...this.help.runningCountHistory], decisionMistakes: [], shoeTCs: [], shoeBets: [],
    };
    if (ok) this.checkEngagement({ type: 'perfectShoe' });
    this.persist();
    const cardsDealt = this.drillState.cardsDealt || 0;
    const countError = Math.abs(playerGuess - actualRunningCount);
    recordTrainingHistorySession(this.save, 'count-shoe', {
      attempts: 1,
      accuracy: ok ? 100 : 0,
      avgError: countError,
      meta: { cardsDealt },
    });
    if (!ok) {
      recordMistakeReviewEntry(this.save, {
        drillId: 'count-shoe',
        category: 'count',
        context: `After ${cardsDealt} cards dealt from the shoe`,
        wrong: fmtSignedCount(playerGuess),
        correct: fmtSignedCount(actualRunningCount),
        detail: `Off by ${countError}`,
        meta: { cardsDealt, guess: playerGuess, actual: actualRunningCount },
      });
    }
    const extra = `You counted through ${cardsDealt} cards in the Count This Shoe drill.`;
    this.showCountQuizFeedback(ok, playerGuess, actualRunningCount, extra);
    this.drillState.quizPending = false;
    this._afterCountQuiz = () => {
      this.showShoeAnalysis(report);
      this.finishDrillWithSummary('count-shoe', {
        correct: ok ? 1 : 0,
        total: 1,
        accuracy: ok ? 100 : 0,
        avgError: countError,
        meta: { cardsDealt },
        subtitle: `${cardsDealt} cards · final count quiz`,
      });
    };
  }

  startDecisionDrill() {
    this.markDrillSessionStart();
    this.drillState = { round: 0, correct: 0 };
    this.dealDecisionHand();
  }

  dealDecisionHand() {
    this.ensureShoe();
    this.dealer.clear();
    this.playerHands = [{ hand: new Hand(), bet: 0, finished: false, doubled: false, fromSplit: false, splitAces: false }];
    const ranks = RANKS;
    const pick = () => createPlayingCard(ranks[Math.floor(Math.random() * ranks.length)], SUITS[Math.floor(Math.random() * 4)]);
    let p = new Hand(), d = new Hand();
    while (p.value() < 12 || p.value() > 16 || p.isBlackjack()) {
      p = new Hand([pick(), pick()]);
    }
    d.add(pick());
    this.playerHands[0].hand = p;
    this.dealer = d;
    this.activeIdx = 0;
    this.hideHole = true;
    this.phase = 'playing';
    this.roundReview = { runningCountAtHandStart: this.counter.runningCount, decisions: [], bet: 0, suggested: 0 };
    this.render();
  }

  finishDecisionDrillRound(action) {
    const st = this.activeState();
    const up = this.dealer.cards[0].rank;
    const advice = advise(st.hand, up, false, false);
    const ok = action === advice.action;
    this.drillState.round++;
    if (ok) this.drillState.correct++;
    this.stats.decisionsTotal++;
    if (ok) this.stats.decisionsCorrect++;
    else {
      this.stats.strategyMistakes++;
      this.help.recordDecisionMistake({ action, optimal: advice.action });
    }
    this.toast(ok ? `✓ Correct: ${advice.action}` : `✗ Optimal: ${advice.action}`, ok ? 'success' : 'info');
    if (!ok) {
      const st = this.activeState();
      recordMistakeReviewEntry(this.save, {
        drillId: 'decisions',
        category: 'strategy',
        context: `Hand ${this.drillState.round}/10: Your ${st?.hand?.value() ?? '?'} vs dealer ${up}`,
        wrong: formatIndexPlayAction(action),
        correct: formatIndexPlayAction(advice.action),
        meta: { handTotal: st?.hand?.value(), dealerUp: up },
      });
      this.showStrategy(advice);
    }
    this.persist();
    if (this.drillState.round >= 10) {
      const pct = Math.round(100 * this.drillState.correct / 10);
      this.checkDailyTrainingProgress('drillSession', {
        drillId: 'decisions',
        accuracy: pct,
        attempts: 10,
      });
      recordTrainingHistorySession(this.save, 'decisions', {
        attempts: 10,
        accuracy: pct,
        avgError: Math.round((10 - this.drillState.correct) / 10 * 10) / 10,
        meta: { correct: this.drillState.correct, total: 10 },
      });
      this.finishDrillWithSummary('decisions', {
        correct: this.drillState.correct,
        total: 10,
        accuracy: pct,
        subtitle: '10-hand basic strategy session',
      });
      return;
    }
    setTimeout(() => this.dealDecisionHand(), 800);
  }

  startBettingDrill() {
    this.markDrillSessionStart();
    this.drillState = { round: 0, correct: 0 };
    this.beginBettingDrillRound();
  }

  beginBettingDrillRound() {
    this.ensureShoe();
    const countSnapshot = this.counter.getCountSnapshot(this.shoe);
    this.betSuggestion = suggestWagerFromCountSnapshot(countSnapshot, this.bankroll, this.settings.unitSize, this.minBet);
    this.drillState.expected = this.betSuggestion.amount;
    this.drillState.round++;
    this.phase = 'bet';
    this.render();
  }

  submitBettingDrill(rawAmount) {
    const validated = validateBetAmount(rawAmount, this.bankroll, this.minBet, { practice: true });
    if (!validated.ok) {
      this.toast(validated.error, 'error');
      return;
    }
    const amount = validated.value;
    const ok = amount === this.drillState.expected;
    if (ok) this.drillState.correct++;
    this.stats.betsTotal++;
    if (ok) this.stats.betsMatched++;
    this.toast(ok ? '✓ Correct bet!' : `✗ Recommended $${this.drillState.expected}`, ok ? 'success' : 'info');
    if (!ok) {
      const snap = this.counter.getCountSnapshot(this.shoe);
      const tc = snap.trueCount;
      const tcFmt = tc >= 0 ? `+${tc.toFixed(1)}` : tc.toFixed(1);
      recordMistakeReviewEntry(this.save, {
        drillId: 'betting',
        category: 'bet',
        context: `Round ${this.drillState.round}/8 · true count ${tcFmt}`,
        wrong: `$${amount}`,
        correct: `$${this.drillState.expected}`,
        detail: this.betSuggestion?.why || recommendedBetWhyText(this.betSuggestion),
        meta: { amount, expected: this.drillState.expected, trueCount: tc },
      });
    }
    for (let i = 0; i < 4; i++) {
      if (this.shoe.cardsRemaining <= 10) break;
      try {
        const c = this.shoe.deal();
        this.counter.recordCardRemovedFromShoe(c);
        this.help.recordRunningCountSnapshot(this.counter.runningCount);
      } catch (err) {
        console.warn('CountQuest: bet drill card deal skipped —', err);
        this.ensureShoe();
        break;
      }
    }
    this.persist();
    if (this.drillState.round >= 8) {
      const pct = Math.round(100 * this.drillState.correct / 8);
      recordTrainingHistorySession(this.save, 'betting', {
        attempts: 8,
        accuracy: pct,
        avgError: Math.round((8 - this.drillState.correct) / 8 * 10) / 10,
        meta: { correct: this.drillState.correct, total: 8 },
      });
      this.finishDrillWithSummary('betting', {
        correct: this.drillState.correct,
        total: 8,
        accuracy: pct,
        subtitle: '8-round bet sizing session',
      });
      return;
    }
    this.beginBettingDrillRound();
  }

  tutorialNext() {
    if (!this.canTutorialNav()) return;
    const t = this.save.tutorial;
    const step = this.tutorialStepIndex();
    this.lockTutorialNav();
    if (step >= TUTORIAL_STEPS.length - 1) {
      t.completed = true;
      t.step = TUTORIAL_STEPS.length - 1;
      this.checkEngagement();
      this.persist();
      this.toast('Tutorial complete! Try Practice Range or Campaign.', 'success', 4000);
      this.startSession(true, 'tutorial');
      return;
    }
    t.step = step + 1;
    this.persist();
    this.render();
  }

  tutorialBack() {
    if (!this.canTutorialNav()) return;
    const step = this.tutorialStepIndex();
    if (step <= 0) {
      this.exitTutorial();
      return;
    }
    this.lockTutorialNav();
    this.save.tutorial.step = step - 1;
    this.persist();
    this.render();
  }

  updateTutorialNavButtons() {
    const step = this.tutorialStepIndex();
    const backBtn = document.getElementById('btn-tutorial-back');
    const nextBtn = document.getElementById('btn-tutorial-next');
    const skipBtn = document.getElementById('btn-tutorial-skip');
    if (backBtn) {
      backBtn.textContent = step <= 0 ? '← Main Menu' : 'Back';
      backBtn.setAttribute('aria-label', step <= 0 ? 'Exit tutorial and return to main menu' : `Go back to step ${step}`);
    }
    if (nextBtn) {
      const isFinal = TUTORIAL_STEPS[step]?.final;
      nextBtn.setAttribute('aria-label', isFinal ? 'Start guided practice session' : `Go to step ${step + 2}`);
    }
    if (skipBtn) {
      skipBtn.setAttribute('aria-label', 'Skip tutorial and start Full Campaign');
    }
  }

  focusTutorialStep() {
    const title = document.getElementById('tutorial-title');
    if (title) title.focus({ preventScroll: true });
  }

  replayTutorialStepAnimation() {
    const panel = document.getElementById('tutorial-panel');
    if (!panel) return;
    panel.classList.remove('tutorial-step');
    void panel.offsetWidth;
    panel.classList.add('tutorial-step');
  }

  renderTutorial() {
    this.save.tutorial.step = this.tutorialStepIndex();
    const stepIdx = this.save.tutorial.step;
    const step = TUTORIAL_STEPS[stepIdx];
    document.getElementById('tutorial-step-label').textContent = `Step ${stepIdx + 1}`;
    document.getElementById('tutorial-progress').textContent = `${stepIdx + 1} / ${TUTORIAL_STEPS.length}`;
    document.getElementById('tutorial-title').textContent = step.title;
    const bodyEl = document.getElementById('tutorial-body');
    const countBlock = document.getElementById('tutorial-count-explanation');
    if (step.countExplanation) {
      bodyEl.classList.add('hidden');
      bodyEl.textContent = '';
      countBlock.classList.remove('hidden');
    } else {
      bodyEl.classList.remove('hidden');
      countBlock.classList.add('hidden');
      if (step.systemBetSizing) {
        const sys = this.activeCountingSystem();
        const pivot = getKoPivot(this.settings.numDecks || 6);
        bodyEl.textContent = sys === 'ko'
          ? `Use a 1–6 unit spread: minimum bet at/below the key (+${pivot}), then add one unit per +1 running count above it. Never wager more than 10% of bankroll.`
          : 'Use a 1–6 unit spread: minimum bet at true count ≤ 0, then add one unit per true-count point. Never wager more than 10% of bankroll in a single hand.';
      } else if (step.bodyHtml) bodyEl.innerHTML = step.bodyHtml;
      else bodyEl.textContent = step.body || '';
    }
    const demo = document.getElementById('tutorial-demo');
    if (step.demo) {
      if (step.systemBetSizing) {
        const sys = this.activeCountingSystem();
        const pivot = getKoPivot(this.settings.numDecks || 6);
        demo.textContent = sys === 'ko'
          ? `Running count +${pivot + 3} vs key +${pivot} → ~4 units ($40 at $10/unit)`
          : 'True count +3 → ~4 units ($40 at $10/unit)';
      } else if (!step.countExplanation) demo.textContent = step.demo;
      demo.classList.remove('hidden');
    } else demo.classList.add('hidden');
    if (step.countExplanation) this.updateTutorialCountExplanation();
    document.getElementById('btn-tutorial-next').textContent = step.final ? 'Start Guided Session' : 'Next';
    this.updateTutorialNavButtons();
    this.replayTutorialStepAnimation();
    requestAnimationFrame(() => this.focusTutorialStep());
  }

  renderCampaign() {
    const unlocks = this.save.campaign.unlocks;
    const done = new Set(this.save.campaign.goalsCompleted);
    document.getElementById('campaign-chapters').innerHTML = CAMPAIGN_CHAPTERS.map(ch => {
      const locked = !unlocks.includes(ch.theme);
      const goalsHtml = ch.goals.map(g => {
        const complete = done.has(g.id);
        return `<li class="text-xs ${complete ? 'text-green-400' : 'text-emerald-300/70'}">${complete ? '✓ ' : '○ '}${g.label}</li>`;
      }).join('');
      return `<div class="mode-card rounded-xl border border-white/10 p-4 ${locked ? 'locked' : ''}">
        <div class="flex justify-between items-start">
          <div><h3 class="font-bold text-gold">${ch.name}</h3><p class="text-xs text-emerald-400/70">${ch.subtitle}</p></div>
          ${locked ? '<span class="text-xs text-amber-400/80">🔒</span>' : ''}
        </div>
        <ul class="mt-2 space-y-1">${goalsHtml}</ul>
        <button class="mt-3 w-full py-2 rounded-lg text-sm font-medium ${locked ? 'bg-white/5 cursor-not-allowed' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'}"
          data-chapter="${ch.id}" ${locked ? 'disabled' : ''}>${locked ? 'Locked' : 'Play Chapter'}</button>
      </div>`;
    }).join('');
  }

  renderDaily() {
    const dc = this.dailyChallenge || dailyChallengeForDate();
    document.getElementById('daily-title').textContent = dc.title;
    document.getElementById('daily-desc').textContent = dc.desc;
    const challengeStatus = this.save.daily.completed
      ? `✓ Completed today! +$${DAILY_CHALLENGE_REWARD} bonus claimed`
      : `In progress — start a session to track · Reward: $${DAILY_CHALLENGE_REWARD}`;
    document.getElementById('daily-progress').textContent = challengeStatus;
    this.renderDailyLoginPanel('daily-login-reward-panel', true);
    this.renderDailyTrainingPanel('daily');
  }

  renderDailyLoginPanel(containerId = 'daily-rewards-streak-card', compact = false) {
    ensureDailyRewardsCurrent(this.save);
    const el = document.getElementById(containerId);
    if (!el) return;
    const dr = this.save.dailyRewards;
    const preview = computeDailyLoginReward(this.save);
    const claimed = dr.claimedToday;
    const cal = DAILY_LOGIN_REWARD_TABLE.map(row => {
      const done = dr.streak > row.day || (dr.streak === row.day && claimed);
      const current = dr.streak === row.day && !claimed;
      const chipLabel = applyVipChipBonus(this.save, row.chips);
      return `<div class="text-center p-2 rounded-lg border ${done ? 'border-emerald-600/40 bg-emerald-950/30' : current ? 'border-amber-500/50 bg-amber-950/30' : 'border-white/10 bg-black/20'}">
        <div class="text-[10px] text-emerald-400/70">Day ${row.day}</div>
        <div class="text-xs font-mono text-emerald-200">${chipLabel}🪙${row.gems ? ` · ${row.gems}💎` : ''}</div>
        <div class="text-[10px] mt-0.5">${done ? '✓' : current ? 'Today' : ''}</div>
      </div>`;
    }).join('');
    const vipBadge = isVipActive(this.save)
      ? '<span class="text-[10px] uppercase tracking-wider text-purple-300 bg-purple-950/50 border border-purple-600/30 px-2 py-0.5 rounded">VIP Active</span>'
      : '';
    el.innerHTML = `
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <p class="text-xs uppercase tracking-wider text-amber-400/80">Daily Login Reward</p>
        ${vipBadge}
        <span class="text-xs font-mono text-amber-300/90">${dr.streak ? `🔥 ${dr.streak}-day streak` : 'Claim to start streak'}</span>
      </div>
      <p class="text-sm text-emerald-100/90 text-center">${claimed
        ? `✓ Claimed today — +${preview.chips.toLocaleString()} chips${preview.gems ? ` · +${preview.gems} 💎` : ''}`
        : `Today's reward: <strong class="text-gold">${preview.chips.toLocaleString()} chips</strong>${preview.gems ? ` · <strong class="text-violet-200">${preview.gems} gem${preview.gems === 1 ? '' : 's'}</strong>` : ''}${preview.vipActive ? ' <span class="text-purple-300/80">(VIP 2×)</span>' : ''}`}</p>
      ${compact ? '' : `<div class="grid grid-cols-7 gap-1">${cal}</div>`}
      <button type="button" id="${containerId}-claim" class="w-full py-3 rounded-xl ${claimed ? 'bg-white/10 text-emerald-300/70' : 'bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-bold'}">${claimed ? 'Come back tomorrow' : 'Claim Daily Reward'}</button>
      ${compact ? `<button type="button" id="${containerId}-more" class="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-emerald-300/80">View all rewards &amp; connect bonuses →</button>` : ''}`;
    document.getElementById(`${containerId}-claim`)?.addEventListener('click', () => {
      if (claimed) this.openDailyRewards();
      else this.claimDailyLoginFromModal();
    });
    document.getElementById(`${containerId}-more`)?.addEventListener('click', () => this.openDailyRewards());
  }

  renderDailyRewards() {
    this.renderDailyLoginPanel('daily-rewards-streak-card');
    const dr = this.save.dailyRewards;
    const calEl = document.getElementById('daily-rewards-calendar');
    if (calEl) {
      calEl.innerHTML = `<p class="text-xs uppercase tracking-wider text-cyan-400/80 mb-2">7-Day Reward Ladder</p>
        <div class="grid grid-cols-7 gap-1">${DAILY_LOGIN_REWARD_TABLE.map(row => {
          const done = dr.streak > row.day || (dr.streak === row.day && dr.claimedToday);
          const current = dr.streak === row.day && !dr.claimedToday;
          const chips = applyVipChipBonus(this.save, row.chips);
          return `<div class="text-center p-2 rounded-lg text-xs border ${done ? 'border-emerald-600/40 bg-emerald-950/30' : current ? 'border-amber-500/50 bg-amber-950/30' : 'border-white/10'}">
            <div class="text-[10px] text-emerald-400/60">D${row.day}</div>
            <div class="font-mono">${chips}🪙</div>
            ${row.gems ? `<div class="text-violet-300/90">${row.gems}💎</div>` : ''}
          </div>`;
        }).join('')}</div>
        <p class="text-[10px] text-emerald-500/60 mt-2 text-center">Day 8+ keeps Day 7 rewards + up to +100 bonus chips</p>`;
    }
    const social = dr.social || defaultDailyRewards().social;
    const socialEl = document.getElementById('daily-rewards-social');
    if (socialEl) {
      socialEl.innerHTML = `
        <p class="text-xs uppercase tracking-wider text-violet-400/80">Connect Bonus (one-time each)</p>
        <p class="text-xs text-emerald-200/85">Link an account for <strong class="text-gold">${SOCIAL_CONNECT_CHIP_BONUS} chips</strong> + <strong class="text-violet-200">${SOCIAL_CONNECT_GEM_BONUS} gems</strong>.
          ${ExternalAuth.isGoogleConfigured() || ExternalAuth.isFacebookConfigured() ? 'OAuth configured in Settings.' : 'Configure OAuth in Settings, or use local connect.'}</p>
        <div id="cq-oauth-google-btn" class="${ExternalAuth.isGoogleConfigured() ? 'flex justify-center' : 'hidden'}"></div>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" id="btn-connect-facebook" class="py-3 rounded-xl text-sm font-semibold ${social.facebookConnected ? 'bg-blue-950/40 border border-blue-700/30 text-blue-200/70' : 'bg-blue-700/30 hover:bg-blue-600/40 border border-blue-500/30 text-blue-100'}" ${social.facebookConnected ? 'disabled' : ''}>${social.facebookConnected ? '✓ Facebook' : 'Facebook Connect'}</button>
          <button type="button" id="btn-connect-google" class="py-3 rounded-xl text-sm font-semibold ${social.googleConnected ? 'bg-slate-800/50 border border-slate-600/30 text-slate-300/70' : 'bg-white/10 hover:bg-white/15 border border-white/15 text-emerald-100'}" ${social.googleConnected ? 'disabled' : ''}>${social.googleConnected ? '✓ Google' : 'Google Connect'}</button>
        </div>`;
      document.getElementById('btn-connect-facebook')?.addEventListener('click', () => this.connectSocialProvider('facebook'));
      document.getElementById('btn-connect-google')?.addEventListener('click', () => this.connectSocialProvider('google'));
    }
    const vipEl = document.getElementById('daily-rewards-vip');
    if (vipEl) {
      const active = isVipActive(this.save);
      const vp = this.save.vipPass || defaultVipPass();
      vipEl.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs uppercase tracking-wider text-purple-400/80">VIP Pass</p>
          ${active ? '<span class="text-[10px] text-purple-200 bg-purple-900/40 px-2 py-0.5 rounded border border-purple-600/30">ACTIVE</span>' : ''}
        </div>
        <p class="text-xs text-emerald-200/85">2× daily login chips · 2× daily synergy bonus · +10% table win payouts · VIP badge</p>
        <p class="text-[10px] text-emerald-500/70">${active ? `Expires ${vp.expiresAt}` : vp.trialUsed ? `Purchase for ${VIP_PASS_COST_GEMS} 💎 (${VIP_PASS_DURATION_DAYS} days)` : `Free ${VIP_TRIAL_DAYS}-day trial available · or ${VIP_PASS_COST_GEMS} 💎 for ${VIP_PASS_DURATION_DAYS} days`}${ExternalIAP.isConfigured() ? ' · Stripe IAP linked' : ''}</p>
        <div class="flex gap-2">
          ${!active && !vp.trialUsed ? `<button type="button" id="btn-vip-trial" class="flex-1 py-2.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/50 border border-purple-600/30 text-sm text-purple-200">Try ${VIP_TRIAL_DAYS} Days Free</button>` : ''}
          ${!active ? `<button type="button" id="btn-vip-purchase" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 text-white font-bold text-sm">${ExternalIAP.isConfigured() ? 'Buy VIP (Stripe)' : `Buy VIP · ${VIP_PASS_COST_GEMS} 💎`}</button>` : `<button type="button" id="btn-vip-extend" class="w-full py-2.5 rounded-xl bg-purple-950/50 border border-purple-600/30 text-sm text-purple-200">Extend +${VIP_PASS_DURATION_DAYS} days · ${ExternalIAP.isConfigured() ? 'Stripe' : `${VIP_PASS_COST_GEMS} 💎`}</button>`}
        </div>`;
      document.getElementById('btn-vip-trial')?.addEventListener('click', () => this.claimVipTrialAction());
      document.getElementById('btn-vip-purchase')?.addEventListener('click', () => this.purchaseVipPassAction());
      document.getElementById('btn-vip-extend')?.addEventListener('click', () => this.purchaseVipPassAction());
    }
  }

  renderDailyTrainingPanel(context = 'daily') {
    this.refreshDailyTrainingGoal();
    const goal = this.dailyTrainingGoal;
    const dt = this.save.dailyTraining;
    const disp = dailyTrainingProgressDisplay(goal, dt.progress, dt.completed);
    const prefix = context === 'training' ? 'training-' : 'daily-';
    const titleEl = document.getElementById(`${prefix}daily-goal`) || document.getElementById('daily-training-title');
    const isTrainingCard = context === 'training';

    if (isTrainingCard) {
      const el = document.getElementById('training-daily-goal');
      if (!el) return;
      const streak = dt.streak || 0;
      const rewardPreview = computeDailyTrainingReward(goal, Math.max(1, streak + (dt.completed ? 0 : 1)));
      const synergy = this.save.daily.completed && dt.completed;
      el.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs uppercase tracking-wider text-cyan-400/80">Today's Training Goal</p>
          <span class="text-xs font-mono text-amber-300/90">${streak ? `🔥 ${streak}-day streak` : 'Start a streak'}</span>
        </div>
        <h3 class="text-base font-bold text-gold">${goal.title}</h3>
        <p class="text-xs text-emerald-200/85">${goal.desc}</p>
        <div class="h-2 rounded-full bg-black/30 overflow-hidden border border-white/5">
          <div class="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-300" style="width:${disp.pct}%"></div>
        </div>
        <p class="text-xs text-cyan-300/90 font-mono">${disp.label}</p>
        <p class="text-[10px] text-emerald-400/60">${dt.completed
          ? `✓ Done — +$${dt.lastReward || rewardPreview} chips${synergy ? ' · synergy bonus earned' : ''}`
          : `Reward: $${rewardPreview} chips · +$${DAILY_TRAINING_SYNERGY_BONUS} if daily challenge also done`}</p>
        ${dt.completed ? '' : `<button type="button" id="btn-training-daily-start" data-launch="${goal.launch}" class="w-full py-2 rounded-lg bg-cyan-950/50 hover:bg-cyan-950/70 border border-cyan-600/40 text-cyan-100 text-xs font-semibold">Go to Drill</button>`}`;
      document.getElementById('btn-training-daily-start')?.addEventListener('click', () => this.launchTrainingDrill(goal.launch));
      return;
    }

    document.getElementById('daily-training-title').textContent = goal.title;
    document.getElementById('daily-training-desc').textContent = goal.desc;
    const streakEl = document.getElementById('daily-training-streak');
    if (streakEl) {
      streakEl.textContent = dt.streak ? `🔥 ${dt.streak}-day streak` : '';
    }
    const bar = document.getElementById('daily-training-progress-bar');
    if (bar) bar.style.width = `${disp.pct}%`;
    document.getElementById('daily-training-progress-text').textContent = disp.label;
    const streakNext = Math.max(1, (dt.streak || 0) + (dt.completed ? 0 : 1));
    const rewardPreview = computeDailyTrainingReward(goal, streakNext);
    document.getElementById('daily-training-reward').textContent = dt.completed
      ? `✓ +$${dt.lastReward} chips awarded${this.save.daily.completed ? ` · synergy +$${DAILY_TRAINING_SYNERGY_BONUS}` : ''}`
      : `Reward: $${rewardPreview} chips · +$${DAILY_TRAINING_SYNERGY_BONUS} synergy if daily challenge also done`;
    const startBtn = document.getElementById('btn-daily-training-start');
    if (startBtn) {
      startBtn.textContent = dt.completed ? 'Goal Complete — Keep Practicing' : 'Start Training Drill';
      startBtn.disabled = false;
      startBtn.dataset.launch = goal.launch;
    }
  }

  checkDailyTrainingProgress(event, data = {}) {
    this.refreshDailyTrainingGoal();
    const goal = this.dailyTrainingGoal;
    const dt = ensureDailyTrainingCurrent(this.save, goal);
    if (dt.completed) return;
    const { progress, met } = evaluateDailyTrainingProgress(goal, dt.progress, event, data);
    dt.progress = progress;
    this.save.dailyTraining = dt;
    if (met) this.completeDailyTraining();
    else this.persist();
    if (this.phase === 'daily' || this.phase === 'training') this.render();
  }

  completeDailyTraining() {
    const goal = this.dailyTrainingGoal || dailyTrainingGoalForDate();
    const dt = ensureDailyTrainingCurrent(this.save, goal);
    if (dt.completed) return;
    const prev = dt.lastCompletedDate;
    const yKey = yesterdayDateKey(goal.date);
    const streak = prev === yKey ? (dt.streak || 0) + 1 : 1;
    const reward = computeDailyTrainingReward(goal, streak);
    dt.completed = true;
    dt.streak = streak;
    dt.lastCompletedDate = goal.date;
    dt.totalCompleted = (dt.totalCompleted || 0) + 1;
    dt.lastReward = reward;
    this.save.dailyTraining = dt;
    this.bankroll += reward;
    this.checkEngagement();
    this.checkDailyRewardsSynergy();
    this.persist();
    Sounds.play('level');
    this.toast(`Daily training goal complete! +$${reward} chips · ${streak}-day streak 🔥`, 'level', 5000);
  }

  checkDailyRewardsSynergy() {
    const d = this.save.daily;
    const dt = this.save.dailyTraining;
    if (!d?.completed || !dt?.completed || dt.synergyClaimed) return;
    dt.synergyClaimed = true;
    const bonus = getEffectiveSynergyBonus(this.save);
    this.bankroll += bonus;
    this.persist();
    const vipNote = isVipActive(this.save) ? ' (VIP 2×)' : '';
    this.toast(`Daily double! Challenge + Training — +$${bonus} synergy bonus${vipNote}`, 'level', 4500);
    Sounds.play('chip');
  }

  checkCampaignGoals() {
    const s = this.stats;
    const done = new Set(this.save.campaign.goalsCompleted);
    const unlocks = new Set(this.save.campaign.unlocks);
    for (const ch of CAMPAIGN_CHAPTERS) {
      for (const g of ch.goals) {
        if (done.has(g.id)) continue;
        let met = false;
        if (g.type === 'countAccuracy' && s.countGuesses >= (g.minGuesses || 0) && calculateCountAccuracyPercent(s) >= g.target) met = true;
        if (g.type === 'decisionAccuracy' && s.decisionsTotal >= (g.minDecisions || 0) && calculateStrategyAccuracyPercent(s) >= g.target) met = true;
        if (g.type === 'bankroll' && this.bankroll >= g.target) met = true;
        if (g.type === 'recentCount' && s.handsPlayed >= 50 && calculateRecentCountAccuracyPercent(s) >= g.target) met = true;
        if (g.type === 'sessionProfit' && this.session && this.session.netPL >= g.target) met = true;
        if (met) {
          done.add(g.id);
          if (g.unlock && !unlocks.has(g.unlock)) {
            unlocks.add(g.unlock);
            const theme = THEMES[g.unlock];
            this.toast(`Unlocked: ${theme?.name || g.unlock}!`, 'level', 4500);
            Sounds.play('level');
          } else {
            this.toast(`Goal complete: ${g.label}`, 'success', 3500);
          }
        }
      }
    }
    this.save.campaign.goalsCompleted = [...done];
    this.save.campaign.unlocks = [...unlocks];
    this.persist();
  }

  checkDailyProgress(type, data) {
    if (this.sessionMode !== 'daily' || this.save.daily.completed) return;
    const dc = this.dailyChallenge || dailyChallengeForDate();
    const p = this.save.daily.progress || {};
    if (dc.type === 'countStreak' && type === 'countQuiz') {
      p.quizCorrect = (p.quizCorrect || 0) + (data.ok ? 1 : 0);
      p.quizTotal = (p.quizTotal || 0) + 1;
      if (p.quizCorrect >= dc.target && p.quizTotal <= dc.total) this.completeDaily();
    }
    if (dc.type === 'sessionDecisions' && type === 'decision') {
      p.decisions = (p.decisions || 0) + 1;
      if (this.session) p.decCorrect = this.session.decisionsCorrect;
      if (p.decisions >= dc.count && this.session && (100 * this.session.decisionsCorrect / p.decisions) >= dc.target)
        this.completeDaily();
    }
    if (dc.type === 'shoeProfit' && type === 'shoeEnd' && this.session && this.session.netPL >= dc.target)
      this.completeDaily();
    if (dc.type === 'betStreak' && type === 'bet') {
      p.betStreak = data.matched ? (p.betStreak || 0) + 1 : 0;
      if (p.betStreak >= dc.target) this.completeDaily();
    }
    this.save.daily.progress = p;
    this.persist();
  }

  checkDailyShoeComplete() { this.checkDailyProgress('shoeEnd', {}); }

  completeDaily() {
    if (this.save.daily.completed) return;
    this.save.daily.completed = true;
    this.bankroll += DAILY_CHALLENGE_REWARD;
    this.checkEngagement();
    this.checkDailyRewardsSynergy();
    this.persist();
    Sounds.play('level');
    this.toast(`Daily challenge complete! +$${DAILY_CHALLENGE_REWARD} bonus ★`, 'level', 5000);
    if (this.phase === 'daily') this.renderDaily();
  }

  showShoeAnalysis(report) {
    if (report.guesses > 0 && report.correct === report.guesses)
      this.checkEngagement({ type: 'perfectShoe' });
    const systemId = this.activeCountingSystem();
    const numDecks = this.settings.numDecks || 6;
    const countingCtx = { systemId, numDecks, pivot: getKoPivot(numDecks) };
    const text = this.help.shoeReport(report, this.rules, countingCtx);
    document.getElementById('shoe-report').textContent = text;
    const sub = document.getElementById('shoe-modal-subtitle');
    if (sub) {
      sub.textContent = systemId === 'ko'
        ? 'End-of-shoe review — running count trend, mistakes, edge from avg vs key'
        : 'End-of-shoe review — count trend, true count edge, mistakes';
    }
    const mistakes = (report.decisionMistakes || []).slice(-3);
    const mel = document.getElementById('shoe-mistakes');
    if (mistakes.length) {
      mel.classList.remove('hidden');
      mel.innerHTML = '<strong>Review these plays:</strong><br>' + mistakes.map(m =>
        `• ${m.action} → should ${m.optimal}`
      ).join('<br>');
    } else mel.classList.add('hidden');
    drawCountCanvas(document.getElementById('shoe-count-canvas'), report.countSamples || []);
    document.getElementById('modal-shoe').showModal();
  }

  usesTableAiSeats() {
    return !this.save.sessionDrill && !!this.session;
  }

  ensureTableAiSeats() {
    if (!this.usesTableAiSeats()) {
      this.tableAiSeats = null;
      return;
    }
    if (!this.tableAiSeats) this.tableAiSeats = createTableAiSeats();
  }

  placeTableAiBets() {
    if (!this.tableAiSeats || !this.shoe) return;
    const snap = this.counter.getCountSnapshot(this.shoe);
    const maxBet = this.session?.tableMaxBet || Math.max(this.minBet * 6, Math.floor(this.bankroll * 0.08));
    for (const seat of Object.values(this.tableAiSeats)) {
      const bet = dealerAIBetForSeat(snap, this.minBet, maxBet);
      seat.bet = bet;
      seat.insurance = 0;
      seat.results = [];
      seat.hands = [{
        hand: new Hand(), bet, finished: false,
        doubled: false, fromSplit: false, splitAces: false,
      }];
    }
  }

  placeTableAiInsurance() {
    if (!this.tableAiSeats || !this.shoe) return;
    const snap = this.counter.getCountSnapshot(this.shoe);
    for (const seat of Object.values(this.tableAiSeats)) {
      seat.insurance = 0;
      const mainBet = seat.hands[0]?.bet || this.minBet;
      if (dealerAITakesInsurance(snap)) seat.insurance = Math.max(1, Math.floor(mainBet / 2));
    }
  }

  async tableAiSplitHand(seat, handIdx) {
    const hs = seat.hands[handIdx];
    const [a, b] = hs.hand.cards;
    const isAces = a.rank === 'A';
    const h1 = new Hand([a]);
    const h2 = new Hand([b]);
    this.dealCardAndUpdateRunningCount(h1, `ai-${seat.seatNum}-split`);
    this.dealCardAndUpdateRunningCount(h2, `ai-${seat.seatNum}-split`);
    seat.hands.splice(handIdx, 1,
      { hand: h1, bet: hs.bet, finished: isAces, doubled: false, fromSplit: true, splitAces: isAces },
      { hand: h2, bet: hs.bet, finished: isAces, doubled: false, fromSplit: true, splitAces: isAces },
    );
    seat.bet = tableAiSeatTotalBet(seat);
  }

  async playTableAiSeats() {
    if (!this.tableAiSeats) return;
    const up = this.dealer.cards[0]?.rank;
    if (!up) return;
    const snap = this.shoe ? this.counter.getCountSnapshot(this.shoe) : null;
    const systemId = this.activeCountingSystem();
    for (const seatNum of TABLE_AI_SEAT_NUMS) {
      const seat = this.tableAiSeats[seatNum];
      if (!seat) continue;
      let guard = 0;
      while (seat.hands.some(h => !h.finished) && guard++ < 48) {
        const hi = seat.hands.findIndex(h => !h.finished);
        if (hi < 0) break;
        const hs = seat.hands[hi];
        if (hs.hand.isBlackjack()) { hs.finished = true; continue; }
        const action = tableAiStrategyAction(hs, up, this.rules, tableAiSplitCount(seat), snap, systemId);
        if (action === 'split') {
          await this.tableAiSplitHand(seat, hi);
          this.render();
          await sleep(140);
          continue;
        }
        if (action === 'double') {
          hs.doubled = true;
          hs.bet *= 2;
          seat.bet = tableAiSeatTotalBet(seat);
          this.dealCardAndUpdateRunningCount(hs.hand, `ai-${seatNum}-double`);
          hs.finished = true;
        } else if (action === 'hit') {
          this.dealCardAndUpdateRunningCount(hs.hand, `ai-${seatNum}-hit`);
          if (hs.hand.isBust() || hs.hand.is21()) hs.finished = true;
        } else {
          hs.finished = true;
        }
        this.render();
        await sleep(110);
      }
      seat.bet = tableAiSeatTotalBet(seat);
    }
  }

  async playTableAiThenDealer() {
    await this.playTableAiSeats();
    await this.dealerPlay();
  }

  settleTableAiSeats() {
    if (!this.tableAiSeats) return;
    for (const seat of Object.values(this.tableAiSeats)) {
      seat.results = (seat.hands || []).map(hs => ({
        r: dealerExpectedPlayerResult(hs.hand, this.dealer, hs.fromSplit),
        label: seat.name,
      }));
    }
  }

  renderTableAiSeatHtml(seat) {
    const showCards = ['playing', 'handEnd'].includes(this.phase);
    const hands = seat.hands || [];
    const handHtml = showCards && hands.length
      ? hands.map((hs, hi) => {
          const cards = hs.hand?.cards || [];
          if (!cards.length) return '';
          const total = hs.hand.size ? hs.hand.value() : '';
          const suffix = hs.doubled ? ' ×2' : '';
          const aiCardN = cards.length;
          const aiRowCls = aiCardN >= 6 ? 'ai-mini-cards-6' : aiCardN >= 5 ? 'ai-mini-cards-5' : '';
          return `<div class="casino-seat-ai-hand">
            ${hands.length > 1 ? `<span class="casino-seat-ai-total">H${hi + 1}</span>` : ''}
            <div class="casino-seat-ai-hand-row ${aiRowCls}">${cards.map(c => renderTableAiMiniCard(c)).join('')}</div>
            <span class="casino-seat-ai-total">${total}${suffix}</span>
          </div>`;
        }).join('')
      : '';
    const totalBet = tableAiSeatTotalBet(seat) || seat.bet || 0;
    const betChip = totalBet
      ? `<span class="casino-seat-bet-chip">$${totalBet}</span>`
      : `<span class="casino-seat-available"><span class="casino-seat-available-icon"></span></span>`;
    let status = totalBet ? `$${totalBet}` : 'Ready';
    let statusCls = '';
    if (this.phase === 'handEnd' && seat.results?.length) {
      const wins = seat.results.filter(r => r.r === 'win' || r.r === 'blackjack').length;
      const losses = seat.results.filter(r => r.r === 'loss' || r.r === 'surrender').length;
      if (wins && !losses) { status = 'Won'; statusCls = 'casino-seat-ai-result-win'; }
      else if (losses && !wins) { status = 'Lost'; statusCls = 'casino-seat-ai-result-loss'; }
      else if (wins === losses) { status = 'Push'; statusCls = 'casino-seat-ai-result-push'; }
      else { status = `${wins}W`; statusCls = 'casino-seat-ai-result-win'; }
    } else if (seat.insurance > 0) {
      status = `Ins $${seat.insurance}`;
    }
    return `<div class="casino-seat-spot casino-seat-cards-mount">${betChip}</div>
      <div class="casino-seat-ai-cards">${handHtml || ''}</div>
      <span class="casino-seat-label">
        <span class="casino-seat-num">${seat.avatar} ${seat.name}</span>
        <span class="casino-seat-status ${statusCls}">${status}</span>
      </span>`;
  }

  renderEmptyCasinoSeatHtml(seatNum) {
    return `<div class="casino-seat-spot casino-seat-cards-mount" aria-hidden="true">
        <span class="casino-seat-available"><span class="casino-seat-available-icon"></span><span class="casino-seat-available-text">Open Seat</span></span>
      </div>
      <span class="casino-seat-label"><span class="casino-seat-num">${seatNum}</span><span class="casino-seat-status">Open Seat</span></span>`;
  }

  beginBetPhase() {
    if (!this.ensureActiveSession()) {
      this.phase = 'menu';
      this.render();
      return;
    }
    this.refillPractice();
    this.ensureShoe();
    this.ensureTableAiSeats();
    this.dealer.clear();
    this.handNetPL = 0;
    this.dealAnimIndex = 0;
    document.getElementById('bet-chip-display')?.classList.add('hidden');
    document.getElementById('casino-seat-bet-indicator')?.classList.add('hidden');
    this.countConfirmed = false;
    this._handendQuizOptional = false;
    // Snapshot RC before this hand — used in hand-end review to show count drift.
    this.roundReview = { runningCountAtHandStart: this.counter.runningCount, decisions: [], bet: 0, suggested: 0 };
    const countSnapshot = this.counter.getCountSnapshot(this.shoe);
    // Bet spread: Hi-Lo uses true count; KO uses RC vs key (pivot).
    this.betSuggestion = suggestWagerFromCountSnapshot(countSnapshot, this.bankroll, this.settings.unitSize, this.minBet);
    if (this.help.requireCountConfirm()) {
      this.phase = 'countConfirm';
      document.getElementById('modal-count-confirm').showModal();
      document.getElementById('count-confirm-result').textContent = '';
      const confirmInput = document.getElementById('count-confirm-input');
      confirmInput.value = '';
      const rcLimit = this.runningCountGuessLimit();
      confirmInput.min = -rcLimit;
      confirmInput.max = rcLimit;
      confirmInput.placeholder = `e.g. +3 (±${rcLimit})`;
    } else if (this.save.sessionDrill === 'combined') {
      this.phase = 'bet';
      this.placeBet(this.minBet);
      return;
    } else {
      this.phase = 'bet';
    }
    this.render();
  }

  /** Help Level 1: player must confirm running count before betting each hand. */
  confirmRunningCountGuess(rawGuess) {
    const parsed = validateRunningCountGuess(rawGuess, this.shoe);
    if (!parsed.ok) {
      this.showFieldError('count-confirm-result', parsed.error);
      this.toast(parsed.error, 'error');
      return;
    }
    const playerGuess = parsed.value;
    const actualRunningCount = this.counter.runningCount;
    const ok = Math.abs(playerGuess - actualRunningCount) <= 1;
    this.showFieldError('count-confirm-result', ok ? '' : `Off by ${Math.abs(playerGuess - actualRunningCount)}`);
    document.getElementById('count-confirm-result').textContent = ok
      ? `✓ Correct! Running count is ${actualRunningCount >= 0 ? '+' : ''}${actualRunningCount}`
      : `✗ Actual running count is ${actualRunningCount >= 0 ? '+' : ''}${actualRunningCount}`;
    this.toast(ok ? 'Count confirmed!' : 'Count off — keep practicing', ok ? 'success' : 'info');
    if (ok) Sounds.play('count');
    setTimeout(() => {
      document.getElementById('modal-count-confirm').close();
      this.phase = 'bet';
      this.countConfirmed = true;
      this.render();
    }, ok ? 600 : 1200);
  }

  async placeBet(rawAmount) {
    if (this.phase !== 'bet') {
      this.toast('Not the betting phase', 'error');
      return;
    }
    if (this.dealing) {
      this.toast('Please wait — cards are being dealt', 'info');
      return;
    }
    if (!this.ensureActiveSession()) return;

    if (this.save.sessionDrill === 'betting') {
      this.submitBettingDrill(rawAmount);
      return;
    }

    const validated = validateBetAmount(rawAmount, this.bankroll, this.minBet, { practice: this.practice });
    if (!validated.ok) {
      this.toast(validated.error, 'error');
      return;
    }
    let amount = validated.value;
    if (this.session?.tableMaxBet != null && amount > this.session.tableMaxBet) {
      this.toast(`Table max bet is ${this.session.tableMaxBet.toLocaleString()} chips`, 'error');
      return;
    }

    if (!this.practice && this.bankroll < this.minBet) {
      this.toast('Insufficient bankroll for minimum bet', 'error');
      return;
    }
    if (!this.betSuggestion) {
      const countSnapshot = this.counter.getCountSnapshot(this.shoe);
      this.betSuggestion = suggestWagerFromCountSnapshot(countSnapshot, this.bankroll, this.settings.unitSize, this.minBet);
    }
    this.roundReview.bet = amount;
    this.roundReview.suggested = this.betSuggestion.amount;
    this.stats.betsTotal++;
    const betMatched = amount === this.betSuggestion.amount;
    if (betMatched) this.stats.betsMatched++;
    this.help.recordHandMeta(this.betSuggestion.betMetric, amount, this.betSuggestion.amount);
    this.checkDailyProgress('bet', { matched: betMatched });
    if (this.session) {
      this.session.betStreak = betMatched ? (this.session.betStreak || 0) + 1 : 0;
    }
    this.bankroll -= amount;
    this.session.wagered += amount;
    this.playerHands = [{ hand: new Hand(), bet: amount, finished: false, doubled: false, fromSplit: false, splitAces: false }];
    this.activeIdx = 0;
    this.splitDone = false;
    this.insuranceBet = 0;
    this.placeTableAiBets();

    Sounds.play('chip');
    this.animateChipFly(amount);
    document.getElementById('bet-placed-amount').textContent = amount;
    const seatBet = document.getElementById('casino-seat-bet-indicator');
    if (seatBet) { seatBet.classList.remove('hidden'); seatBet.setAttribute('aria-hidden', 'false'); }
    await sleep(450);
    await this.dealInitial();
  }

  /**
   * Deal one card from the shoe, update Hi-Lo running count, and add to a hand.
   * COUNTING RULE: every card that leaves the shoe counts — player, dealer, hits,
   * doubles, splits, hole card, and the burn card after shuffle.
   */
  dealCardAndUpdateRunningCount(hand, dealNote) {
    if (!this.shoe) {
      this.toast('Shoe not ready — reshuffling', 'error');
      this.ensureShoe();
      if (!this.shoe) throw new Error('Shoe unavailable');
    }
    if (this.shoe.cardsRemaining < 1) {
      this.ensureShoe();
      if (this.shoe.cardsRemaining < 1) {
        this.toast('Shoe empty — cannot deal', 'error');
        throw new Error('Shoe empty');
      }
    }
    let dealtCard;
    try {
      dealtCard = this.shoe.deal();
    } catch (err) {
      console.error('CountQuest: deal failed —', err);
      this.ensureShoe();
      this.toast('Deal error — shoe reshuffled', 'error');
      throw err;
    }
    const hiLoTag = this.counter.recordCardRemovedFromShoe(dealtCard);
    hand.add(dealtCard);
    this.lastHiLoTagDealt = hiLoTag;
    this.help.recordRunningCountSnapshot(this.counter.runningCount);
    if (hiLoTag !== 0 && this.wantsCountPopups() && (this.help.showPerCardCount() || this.help.showCountAtTable()))
      this.flashHiLoTagOnScreen(hiLoTag);
    Sounds.play('card');
    return { card: dealtCard, hiLoTag, dealNote };
  }

  async dealCardAnimated(hand, note, isHole = false) {
    this.dealCardAndUpdateRunningCount(hand, note);
    this.dealAnimIndex++;
    this.phase = 'playing';
    this.hideHole = isHole || this.hideHole;
    this.render();
    await sleep(isHole ? 320 : 260);
  }

  async dealInitial() {
    this.dealing = true;
    try {
    this.dealAnimIndex = 0;
    this.hideHole = false;
    this.dealer.clear();
    this.playerHands[0].hand.clear();
    const useTableAi = !!this.tableAiSeats;
    const dealToSeat = async (seatNum) => {
      if (seatNum === 4) await this.dealCardAnimated(this.playerHands[0].hand, 'player');
      else if (this.tableAiSeats?.[seatNum]) await this.dealCardAnimated(this.tableAiSeats[seatNum].hands[0].hand, `ai-${seatNum}`);
    };
    if (useTableAi) {
      for (const seatNum of TABLE_DEAL_ORDER) await dealToSeat(seatNum);
      await this.dealCardAnimated(this.dealer, 'dealer up');
      for (const seatNum of TABLE_DEAL_ORDER) await dealToSeat(seatNum);
    } else {
      await this.dealCardAnimated(this.playerHands[0].hand, 'player');
      await this.dealCardAnimated(this.dealer, 'dealer up');
      await this.dealCardAnimated(this.playerHands[0].hand, 'player');
    }
    this.hideHole = true;
    await this.dealCardAnimated(this.dealer, 'dealer hole', true);

    const up = this.dealer.cards[0]?.rank;
    if (!up) throw new Error('Dealer upcard missing');
    if (up === 'A') {
      this.placeTableAiInsurance();
      this.dealing = false;
      this.showInsuranceModal();
      this.render();
      return;
    }
    this.dealing = false;
    this.afterInsurance();
    } catch (err) {
      console.error('CountQuest: dealInitial failed —', err);
      this.toast('Could not complete the deal — try placing your bet again', 'error', 4000);
      this.dealing = false;
      this.phase = 'bet';
      if (this.playerHands[0]) {
        this.bankroll += this.playerHands[0].bet;
        if (this.session) this.session.wagered = Math.max(0, this.session.wagered - this.playerHands[0].bet);
      }
      this.render();
      return;
    }
  }

  animateChipFly(amount) {
    const src = document.getElementById('btn-deal') || document.getElementById('chip-buttons');
    const felt = document.querySelector('#casino-seat-human .casino-seat-spot') || document.getElementById('casino-seat-human') || document.querySelector('.casino-table-surface');
    if (!src || !felt) return;
    const s = src.getBoundingClientRect();
    const t = felt.getBoundingClientRect();
    const chip = document.createElement('div');
    chip.className = 'flying-chip';
    chip.textContent = '$' + amount;
    chip.style.left = (s.left + s.width / 2 - 28) + 'px';
    chip.style.top = (s.top - 28) + 'px';
    const dx = t.left + t.width / 2 - s.left - s.width / 2;
    const dy = t.top + t.height / 2 - s.top;
    chip.style.setProperty('--dx', dx + 'px');
    chip.style.setProperty('--dy', dy + 'px');
    chip.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.3}px) scale(1.1)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 },
    ], { duration: 550, easing: 'cubic-bezier(.4,0,.2,1)' });
    document.body.appendChild(chip);
    setTimeout(() => chip.remove(), 600);
  }

  /** Brief +1/−1 popup when a non-neutral card is dealt (Novice / Tutorial modes). */
  flashHiLoTagOnScreen(hiLoTag) {
    if (!this.wantsCountPopups()) return;
    Sounds.play('count');
    const hud = document.getElementById('count-hud') || document.getElementById('count-hud-bet');
    if (hud) {
      const rcBox = hud.querySelector('[data-count="running"]');
      if (rcBox) {
        rcBox.classList.remove('count-pop-plus', 'count-pop-minus');
        void rcBox.offsetWidth;
        rcBox.classList.add(hiLoTag > 0 ? 'count-pop-plus' : 'count-pop-minus');
      }
    }
    const wrap = document.createElement('div');
    wrap.className = `count-change-popup ${hiLoTag > 0 ? 'plus' : 'minus'}`;
    wrap.style.left = Math.max(12, window.innerWidth / 2 - 110) + 'px';
    wrap.style.top = '120px';
    wrap.innerHTML = `<span>${formatCountChangeLabel(hiLoTag)}</span>${infoTipButton(COUNT_DELTA_TIP, 'What does count change mean?')}`;
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 1100);
  }

  revealDealerHole() {
    if (!this.hideHole) return;
    this.revealHoleAnim = true;
    this.hideHole = false;
    Sounds.play('flip');
    this.render();
    setTimeout(() => { this.revealHoleAnim = false; }, 600);
  }

  showInsuranceModal() {
    const dlg = document.getElementById('modal-insurance');
    const snap = this.shoe ? this.counter.getCountSnapshot(this.shoe) : null;
    const insAdvice = adviseInsurance(snap?.trueCount ?? null, this.activeCountingSystem(), this.usesIndexDeviations());
    const hint = this.help.showStrategyAlways() || this.help.showStrategyOnMistake()
      ? `<p class="text-xs text-cyan-200/90 mb-3 bg-black/25 rounded-lg px-3 py-2">Strategy → ${formatIndexPlayAction(insAdvice.action)}: ${insAdvice.rationale}</p>`
      : '';
    dlg.innerHTML = `<h3 class="font-bold text-lg mb-2">Insurance</h3>
      <p class="text-sm text-emerald-200/80 mb-2">Dealer shows Ace. Max half your bet.</p>${hint}
      <div class="flex gap-2">
        <button id="btn-ins-no" type="button" class="flex-1 py-2 rounded-lg bg-white/10">No</button>
        <button id="btn-ins-yes" type="button" class="flex-1 py-2 rounded-lg bg-amber-500 text-stone-900 font-bold">Yes (max)</button>
      </div>`;
    this.bindClick('btn-ins-no', () => this.resolveInsurance(false));
    this.bindClick('btn-ins-yes', () => this.resolveInsurance(true));
    dlg.showModal();
  }

  resolveInsurance(take) {
    document.getElementById('modal-insurance').close();
    const snap = this.shoe ? this.counter.getCountSnapshot(this.shoe) : null;
    const insAdvice = adviseInsurance(snap?.trueCount ?? null, this.activeCountingSystem(), this.usesIndexDeviations());
    const optimal = insAdvice.action === 'insurance';
    const indexPlay = this.usesIndexDeviations() && !!insAdvice.useIndex;
    if (this.roundReview) {
      this.roundReview.decisions.push({
        action: take ? 'insurance' : 'no-insurance',
        advice: insAdvice.action,
        mistake: (take !== optimal),
        indexPlay,
      });
      this.stats.decisionsTotal++;
      if (take !== optimal) {
        this.stats.strategyMistakes++; this.help.shoeMistakes++;
        this.help.recordDecisionMistake({ action: take ? 'insurance' : 'no-insurance', optimal: insAdvice.action });
        this.recordLiveStrategyMistake(
          take ? 'insurance' : 'no-insurance',
          insAdvice,
          `Insurance vs dealer Ace · TC ${snap?.trueCount?.toFixed?.(1) ?? '—'}`,
        );
      }
    }
    const main = this.playerHands[0].bet;
    const max = maxInsurance(main);
    this.insuranceBet = take ? Math.min(max, this.bankroll) : 0;
    if (this.insuranceBet > 0) {
      this.bankroll -= this.insuranceBet;
      this.session.wagered += this.insuranceBet;
      this.session.insTaken++;
    }
    this.afterInsurance();
  }

  afterInsurance() {
    const up = this.dealer.cards[0].rank;
    const peek = up === 'A' || isTenValueRank(up);
    const playerBJ = this.playerHands[0].hand.isBlackjack();
    const dealerBJ = peek && this.dealer.isBlackjack();

    if (this.insuranceBet > 0) {
      const net = insurancePayout(this.insuranceBet, dealerBJ);
      if (dealerBJ) { this.bankroll += this.insuranceBet + net; this.session.insWon++; this.toast(`Insurance pays +$${net}`); }
      else this.toast(`Insurance lost -$${this.insuranceBet}`);
      this.session.netPL += net;
    }

    if (peek && (dealerBJ || playerBJ)) {
      this.revealDealerHole();
      this.results = [this.settleHand(this.playerHands[0], 'You')];
      setTimeout(() => this.finishHand(), 400);
      return;
    }
    if (playerBJ) {
      this.revealDealerHole();
      this.results = [this.settleHand(this.playerHands[0], 'You')];
      setTimeout(() => this.finishHand(), 400);
      return;
    }
    this.render();
  }

  activeState() { return this.playerHands[this.activeIdx]; }

  canDouble(st) {
    if (!this.rules.das && st.fromSplit) return false;
    return st.hand.size === 2 && !st.doubled && this.bankroll >= st.bet;
  }
  canSplit(st) {
    return !this.splitDone && this.playerHands.length === 1 && canSplit(st.hand) && this.bankroll >= st.bet;
  }
  canSurrender(st) {
    return this.rules.lateSurrender && !st.fromSplit && !st.doubled && st.hand.size === 2 && !st.finished;
  }

  playerAction(action) {
    if (this.phase !== 'playing') return;
    if (!VALID_PLAYER_ACTIONS.has(action)) {
      this.toast(`Unknown action: ${action}`, 'error');
      return;
    }
    if (this.dealing) {
      this.toast('Please wait — cards are being dealt', 'info');
      return;
    }
    if (this.save.sessionDrill === 'decisions') {
      this.finishDecisionDrillRound(action);
      return;
    }
    const st = this.activeState();
    if (!st || st.finished) return;
    if (!this.ensureActiveSession()) return;

    if (action === 'double' && !this.canDouble(st)) {
      this.toast('Cannot double now (need 2 cards, chips, and table rules)', 'error');
      return;
    }
    if (action === 'split' && !this.canSplit(st)) {
      this.toast('Cannot split this hand', 'error');
      return;
    }
    if (action === 'surrender' && !this.canSurrender(st)) {
      this.toast('Surrender not available on this hand', 'error');
      return;
    }
    const up = this.dealer.cards[0].rank;
    const snap = this.shoe ? this.counter.getCountSnapshot(this.shoe) : null;
    const stratOpts = this.buildStratOpts(snap);
    const advice = advise(st.hand, up, this.canDouble(st), this.canSplit(st), stratOpts);
    const total = st.hand.value();
    const indexPlay = isIndexDeviationRationale(advice.rationale);

    if (this.roundReview) {
      this.roundReview.decisions.push({ action, advice: advice.action, mistake: action !== advice.action, indexPlay });
      this.stats.decisionsTotal++;
      if (action !== advice.action) {
        this.stats.strategyMistakes++; this.help.shoeMistakes++;
        this.help.sessionMistakes.push({ action, optimal: advice.action });
        this.help.recordDecisionMistake({ action, optimal: advice.action });
        if (this.save.sessionDrill === 'combined') {
          recordMistakeReviewEntry(this.save, {
            drillId: 'combined',
            category: indexPlay ? 'deviation' : 'strategy',
            context: `Hand ${this.session?.hands || '?'}: Your ${total} vs dealer ${up}`,
            wrong: formatIndexPlayAction(action),
            correct: formatIndexPlayAction(advice.action),
            meta: { handTotal: total, dealerUp: up, indexPlay },
          });
        } else {
          this.recordLiveStrategyMistake(action, advice, `Hand ${this.session?.hands || '?'}: ${total} vs dealer ${up}`);
        }
      } else this.stats.decisionsCorrect++;
      if (this.session) {
        this.session.decisions = (this.session.decisions || 0) + 1;
        if (action === advice.action) this.session.decisionsCorrect = (this.session.decisionsCorrect || 0) + 1;
        this.checkDailyProgress('decision', { ok: action === advice.action });
      }
    }

    if (action === 'surrender' && this.canSurrender(st)) {
      st.finished = true;
      const net = payout(st.bet, 'surrender', this.rules);
      this.bankroll += st.bet + net;
      this.handNetPL += net;
      this.session.netPL += net;
      this.results = [{ r: 'surrender', net, label: 'You' }];
      this.finishHand();
      return;
    }

    if (this.help.shouldShowHint(advice, total, action) && this.help.showStrategyOnMistake())
      this.showStrategy(advice);

    if (action === 'split') {
      this.splitDone = true;
      const [a, b] = st.hand.cards;
      const isAces = a.rank === 'A';
      this.bankroll -= st.bet;
      this.session.wagered += st.bet;
      const h1 = new Hand([a]), h2 = new Hand([b]);
      this.dealCardAndUpdateRunningCount(h1, 'split');
      this.dealCardAndUpdateRunningCount(h2, 'split');
      this.playerHands = [
        { hand: h1, bet: st.bet, finished: isAces, doubled: false, fromSplit: true, splitAces: isAces },
        { hand: h2, bet: st.bet, finished: isAces, doubled: false, fromSplit: true, splitAces: isAces },
      ];
      this.activeIdx = 0;
      this.advancePlayer();
      return;
    }
    if (action === 'double') {
      this.bankroll -= st.bet;
      this.session.wagered += st.bet;
      st.bet *= 2;
      st.doubled = true;
      this.dealAnimIndex++;
      this.dealCardAndUpdateRunningCount(st.hand, 'double');
      st.finished = true;
      this.advancePlayer();
      return;
    }
    if (action === 'hit') {
      this.dealAnimIndex++;
      this.dealCardAndUpdateRunningCount(st.hand, 'hit');
      if (st.hand.isBust() || st.hand.is21()) st.finished = true;
      else { this.render(); return; }
      this.advancePlayer();
      return;
    }
    st.finished = true;
    this.advancePlayer();
  }

  advancePlayer() {
    while (this.activeIdx < this.playerHands.length) {
      const st = this.playerHands[this.activeIdx];
      if (!st.finished) { this.render(); return; }
      this.activeIdx++;
    }
    if (this.tableAiSeats) this.playTableAiThenDealer();
    else this.dealerPlay();
  }

  async dealerPlay() {
    if (this.playerHands.every(h => h.hand.isBust())) {
      this.revealDealerHole();
      await sleep(350);
      this.settleAll();
      this.finishHand();
      return;
    }
    this.revealDealerHole();
    await sleep(400);
    while (dealerShouldHit(this.dealer, this.rules)) {
      this.dealAnimIndex++;
      this.dealCardAndUpdateRunningCount(this.dealer, 'dealer hit');
      this.render();
      await sleep(380);
    }
    this.settleAll();
    this.finishHand();
  }

  resultFor(st) {
    let r = compareHands(st.hand, this.dealer);
    if (st.fromSplit && r === 'blackjack') r = 'win';
    return r;
  }

  settleHand(st, label) {
    const r = this.resultFor(st);
    const net = payout(st.bet, r, this.rules);
    this.bankroll += st.bet + net;
    this.handNetPL += net;
    this.session.netPL += net;
    return { r, net, label };
  }

  settleAll() {
    this.results = this.playerHands.map((st, i) => {
      const label = this.playerHands.length > 1 ? `Hand ${i+1}` : 'You';
      return { ...this.settleHand(st, label), label };
    });
    this.settleTableAiSeats();
  }

  finishHand() {
    this.help.shoeHands++;
    this.session.hands++;
    this.save.sessionHands = this.session.hands;
    this.save.sessionNetPL = this.session.netPL;
    const promos = recordHandEnd(this.stats, this.bankroll, this.handNetPL);

    if (this.handNetPL > 0) {
      Sounds.play(this.handNetPL >= 100 ? 'bigwin' : 'win');
      this.toast(this.handNetPL >= 100 ? `Big win! +$${this.handNetPL}` : `+$${this.handNetPL} this hand`, 'win');
    } else if (this.handNetPL < 0) {
      Sounds.play('loss');
      this.toast(`-$${Math.abs(this.handNetPL)} this hand`, 'loss');
    }
    const bj = (this.results || []).some(r => r.r === 'blackjack');
    if (bj) this.toast('Blackjack! ★', 'win', 3500);

    if (promos.rankUp !== null) {
      Sounds.play('level');
      this.toast(`★ Rank up! ${['Novice','Apprentice','Journeyman','Expert','Master'][promos.rankUp]}`, 'level', 4000);
    }
    const previousHelpLevel = promos.levelUp !== null ? promos.levelUp - 1 : this.stats.helpLevel;
    if (promos.levelUp !== null) {
      this.help.level = promos.levelUp;
      this.stats.helpLevel = promos.levelUp;
    }
    this.checkEngagement({
      type: 'handEnd', handNetPL: this.handNetPL, sessionNetPL: this.session?.netPL,
    });
    if (this.sessionMode === 'tournament' && this.save.tournament?.match) {
      const m = this.save.tournament.match;
      m.handsPlayed = (m.handsPlayed || 0) + 1;
      m.playerNetPL = this.session?.netPL ?? 0;
    }
    this.persist();
    this.phase = 'handEnd';
    this.render();

    const showFollowUps = () => this.showPostHandModals();
    if (promos.levelUp !== null) {
      this.showHelpLevelUpCelebration(previousHelpLevel, promos.levelUp, showFollowUps);
    } else {
      showFollowUps();
    }
    this.checkCampaignGoals();
  }

  /** Post-hand quiz: ±1 on running count counts as correct (real casino tolerance). */
  submitRunningCountQuiz(rawGuess) {
    if (this.drillState?.quizPending) {
      this.submitDrillCountQuiz(rawGuess);
      return;
    }
    const parsed = validateRunningCountGuess(rawGuess, this.shoe);
    if (!parsed.ok) {
      this.showFieldError('count-quiz-result', parsed.error);
      this.toast(parsed.error, 'error');
      return;
    }
    const playerGuess = parsed.value;
    const actualRunningCount = this.counter.runningCount;
    const ok = Math.abs(playerGuess - actualRunningCount) <= 1;
    this.stats.countGuesses++;
    if (ok) { this.stats.countCorrect++; this.help.shoeCorrect++; }
    this.help.shoeGuesses++;
    if (this.session) {
      this.session.countQuizTotal = (this.session.countQuizTotal || 0) + 1;
      if (ok) this.session.countQuizCorrect = (this.session.countQuizCorrect || 0) + 1;
    }
    this.checkDailyProgress('countQuiz', { ok });
    this.trackClubWeekly(ok ? 'countCorrect' : 'countWrong');
    this.stats.recentCount.push(ok);
    if (this.stats.recentCount.length > 100) this.stats.recentCount.shift();
    const acc = calculateCountAccuracyPercent(this.stats).toFixed(0);
    let extra = `Your lifetime count quiz accuracy is now ${acc}%.`;
    if (this.save.sessionDrill === 'combined') {
      const decisions = this.roundReview?.decisions || [];
      const stratCorrect = decisions.filter(d => !d.mistake).length;
      const stratTotal = decisions.length;
      const handNum = this.session?.hands || (this.combinedPracticeVisit?.length || 0) + 1;
      if (!ok) {
        recordMistakeReviewEntry(this.save, {
          drillId: 'combined',
          category: 'count',
          context: `Hand ${handNum} — post-hand running count quiz`,
          wrong: fmtSignedCount(playerGuess),
          correct: fmtSignedCount(actualRunningCount),
          detail: `Off by ${Math.abs(playerGuess - actualRunningCount)}`,
          meta: { handNum, guess: playerGuess, actual: actualRunningCount },
        });
      }
      this.combinedPracticeVisit = this.combinedPracticeVisit || [];
      this.combinedPracticeVisit.push({
        handNum,
        countOk: ok,
        guess: playerGuess,
        actual: actualRunningCount,
        stratCorrect,
        stratTotal,
      });
      this.checkDailyTrainingProgress('combinedHand', {});
      if (this.phase === 'handEnd') this.renderHandEnd();
      const stratLine = stratTotal === 0
        ? 'Strategy: no decisions this hand.'
        : stratCorrect === stratTotal
          ? `Strategy: ✓ ${stratCorrect}/${stratTotal} — all basic strategy plays correct.`
          : `Strategy: ${stratCorrect}/${stratTotal} correct — see hand review below for optimal plays.`;
      extra = `${stratLine}<br><br>Session: ${this.combinedSessionSummaryText()}`;
      this.toast(
        `${ok ? 'Count ✓' : 'Count ✗'} · ${stratLine.replace('Strategy: ', '')}`,
        ok && stratCorrect === stratTotal ? 'success' : 'info',
        3500,
      );
    } else {
      this.toast(ok ? `Count correct! Lifetime accuracy: ${acc}%` : `Lifetime count accuracy: ${acc}%`, ok ? 'success' : 'info');
    }
    if (ok) Sounds.play('count');
    this.checkEngagement();
    this.persist();
    this.showCountQuizFeedback(ok, playerGuess, actualRunningCount, extra);
    this._afterCountQuiz = null;
  }

  setHelpLevel(lvl) {
    const level = Math.max(0, Math.min(4, Math.floor(Number(lvl) || 0)));
    const previous = this.help.level;
    if (level === previous) return;
    this.help.level = level;
    this.stats.helpLevel = level;
    this.persist();
    this.render();
    this.toast(`Help Level ${level} — ${HELP_LABELS[level]}`, 'level', 2500);
  }

  showStrategy(advice) {
    const el = document.getElementById('strategy-hint');
    el.textContent = `Strategy → ${advice.action.toUpperCase()}: ${advice.rationale}`;
    el.classList.remove('hidden');
  }

  toast(msg, type = 'info', duration = 3000) {
    const stack = document.getElementById('toast-stack');
    const styles = {
      info: 'bg-slate-800/95 border-slate-600 text-white backdrop-blur-sm',
      success: 'bg-emerald-700/95 border-emerald-500 text-white backdrop-blur-sm',
      error: 'bg-red-950/95 border-red-500 text-red-50 font-medium backdrop-blur-sm',
      win: 'bg-gradient-to-r from-amber-500 to-amber-400 border-amber-300 text-stone-900 font-bold shadow-amber-900/30',
      loss: 'bg-red-900/95 border-red-600 text-red-100 backdrop-blur-sm',
      level: 'bg-purple-800/95 border-purple-500 text-purple-100 backdrop-blur-sm shadow-purple-900/25',
    };
    const icons = { info: 'ℹ️', success: '✓', error: '✕', win: '🎉', loss: '—', level: '⭐' };
    const el = document.createElement('div');
    el.className = `toast-item px-4 py-3 rounded-xl border shadow-lg text-sm flex items-start gap-2 ${styles[type] || styles.info}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="shrink-0 opacity-90" aria-hidden="true">${icons[type] || icons.info}</span><span class="flex-1 leading-snug">${msg}</span>`;
    stack.appendChild(el);
    if (Sounds.enabled && (type === 'win' || type === 'level')) {
      Sounds.play(type === 'win' ? 'reward' : 'level');
    }
    setTimeout(() => el.remove(), duration);
  }

  // ═══════════════════════════════════════════════════════════════
  // §8 RENDER & EVENTS
  // ═══════════════════════════════════════════════════════════════
  bindCountInputEnter(inputId, submitFn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitFn(); }
    });
  }

  bindClick(id, fn) {
    const el = document.getElementById(id);
    if (!el) { console.warn(`CountQuest: #${id} not found — skipping bind`); return; }
    el.onclick = fn;
  }

  closeAllModals() {
    document.querySelectorAll('dialog').forEach(d => { if (d.open) d.close(); });
  }

  bindUI() {
    const menuActions = {
      '1': () => this.openTutorial(),
      '2': () => this.openPracticeRange(),
      '3': () => this.openCampaign(),
      '4': () => this.openDaily(),
      '5': () => this.openTrainingMode(),
      '6': () => this.openTableLobby(),
      '7': () => this.openClubs(),
      '8': () => this.openDailyRewards(),
    };
    document.getElementById('menu-buttons')?.addEventListener('click', (e) => {
      const card = e.target.closest('.mode-card');
      if (!card?.dataset.k) return;
      menuActions[card.dataset.k]?.();
    });
    document.getElementById('screen-menu')?.addEventListener('click', (e) => {
      const buy = e.target.closest('[data-lobby-buy]');
      if (buy) { e.preventDefault(); lobbyTapFeedback('tap'); this.handleLobbyCurrencyBuy(buy.dataset.lobbyBuy); return; }
      const nav = e.target.closest('[data-lobby-nav]');
      if (nav) {
        e.preventDefault();
        lobbyTapFeedback(nav.querySelector('.lobby-nav-badge') ? 'sparkle' : 'tap');
        this.handleLobbyNav(nav.dataset.lobbyNav);
        return;
      }
      const play = e.target.closest('[data-lobby-play]');
      if (play) { e.preventDefault(); lobbyTapFeedback('whoosh'); this.handleLobbyPlay(play.dataset.lobbyPlay); return; }
      const mg = e.target.closest('[data-lobby-minigame]');
      if (mg) { e.preventDefault(); lobbyTapFeedback('reward'); this.openLobbyMinigame(mg.dataset.lobbyMinigame); return; }
      if (e.target.closest('#lobby-pass-banner')) { e.preventDefault(); lobbyTapFeedback('sparkle'); this.openDailyRewards(); }
    });
    this.bindClick('btn-lobby-shop-close', () => document.getElementById('modal-lobby-shop').close());
    this.bindClick('btn-lobby-leaderboards-close', () => document.getElementById('modal-lobby-leaderboards').close());
    this.bindClick('btn-lobby-minigame-close', () => document.getElementById('modal-lobby-minigame').close());
    this.bindClick('btn-lobby-minigame-action', () => this.playLobbyMinigame());
    document.getElementById('lobby-shop-items')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-shop-item]');
      if (btn && !btn.disabled) this.purchaseShopItem(btn.dataset.shopItem);
    });
    document.getElementById('practice-range-drills')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-drill]');
      if (!btn) return;
      this.launchTrainingDrill(btn.dataset.drill);
    });
    document.getElementById('training-drill-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-training-drill]');
      if (!btn || btn.disabled) return;
      this.launchTrainingDrill(btn.dataset.trainingDrill);
    });
    this.bindClick('btn-training-back', () => this.goMenu());
    this.bindClick('btn-dealer-mode-start', () => this.startDealerShift());
    this.bindClick('btn-dealer-mode-back', () => this.dealerGoBack());
    this.bindClick('btn-dealer-summary-back', () => this.dealerGoBack());
    this.bindClick('btn-dealer-summary-again', () => this.startDealerShift());
    this.bindClick('btn-dealer-quit', () => this.endDealerShift(true));
    document.getElementById('dealer-action-panel')?.addEventListener('click', (e) => {
      const pay = e.target.closest('[data-dealer-payout]');
      if (pay) { e.preventDefault(); Sounds.init(); this.submitDealerPayout(pay.dataset.dealerPayout); return; }
      const act = e.target.closest('[data-dealer-action]');
      if (act) { e.preventDefault(); Sounds.init(); this.submitDealerAction(act.dataset.dealerAction); return; }
      const ins = e.target.closest('[data-dealer-insurance]');
      if (ins) { e.preventDefault(); Sounds.init(); this.submitDealerInsurancePayout(ins.dataset.dealerInsurance); return; }
      if (e.target.closest('#btn-dealer-count-submit')) {
        e.preventDefault();
        this.submitDealerCountQuiz(document.getElementById('dealer-count-quiz-input')?.value ?? '');
      }
    });
    this.bindClick('btn-training-history', () => this.openTrainingHistory());
    this.bindClick('btn-training-history-back', () => this.openTrainingMode());
    this.bindClick('btn-training-mistakes', () => this.openMistakeReview());
    this.bindClick('btn-training-mistakes-back', () => this.openTrainingMode());
    this.bindClick('btn-drill-summary-back', () => this.drillSummaryGoBack());
    this.bindClick('btn-drill-summary-retry', () => this.drillSummaryRetry());
    document.getElementById('training-history-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-history-filter]');
      if (!btn) return;
      this.trainingHistoryFilter = btn.dataset.historyFilter;
      this.renderTrainingHistory();
    });
    document.getElementById('training-mistakes-filters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mistake-filter]');
      if (!btn) return;
      this.mistakeReviewFilter = btn.dataset.mistakeFilter;
      this.renderMistakeReview();
    });
    document.getElementById('campaign-chapters')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-chapter]');
      if (!btn || btn.disabled) return;
      this.startSession(false, 'campaign', null, btn.dataset.chapter);
    });
    document.getElementById('action-buttons')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      this.playerAction(btn.dataset.action);
    });
    document.getElementById('chip-buttons')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bet]');
      if (!btn) return;
      Sounds.init();
      Sounds.play('chip');
      document.getElementById('bet-input').value = btn.dataset.bet;
      this.updateSeatBetIndicator(btn.dataset.bet);
      btn.classList.add('placed');
      setTimeout(() => btn.classList.remove('placed'), 350);
    });
    document.getElementById('bet-input')?.addEventListener('input', (e) => {
      this.updateSeatBetIndicator(e.target.value || this.minBet);
    });

    this.bindClick('btn-deal', () => {
      Sounds.init();
      const raw = document.getElementById('bet-input').value;
      const fallback = this.betSuggestion?.amount ?? this.minBet;
      this.placeBet(raw.trim() === '' ? fallback : raw);
    });
    this.bindClick('btn-sound', () => {
      Sounds.init();
      Sounds.setEnabled(!Sounds.enabled);
      this.save.settings.soundEnabled = Sounds.enabled;
      this.persist();
      this.updateSoundButton();
      this.toast(Sounds.enabled ? 'Sound on' : 'Sound off', 'info', 1500);
    });
    const toggleSound = document.getElementById('toggle-sound');
    if (toggleSound) toggleSound.onchange = (e) => {
      Sounds.setEnabled(e.target.checked);
      this.save.settings.soundEnabled = Sounds.enabled;
      this.persist();
      this.updateSoundButton();
    };
    const submitCountConfirm = () => {
      this.confirmRunningCountGuess(document.getElementById('count-confirm-input').value);
    };
    this.bindClick('btn-count-confirm', submitCountConfirm);
    this.bindCountInputEnter('count-confirm-input', submitCountConfirm);
    this.bindClick('btn-ins-no', () => this.resolveInsurance(false));
    this.bindClick('btn-ins-yes', () => this.resolveInsurance(true));
    const submitCountQuiz = () => {
      this.submitRunningCountQuiz(document.getElementById('count-quiz-input').value);
    };
    this.bindClick('btn-count-quiz', submitCountQuiz);
    this.bindCountInputEnter('count-quiz-input', submitCountQuiz);
    this.bindClick('btn-count-quiz-continue', () => this.dismissCountQuiz());
    this.bindClick('btn-count-quiz-skip', () => {
      if (this.drillState) this.drillState.quizPending = false;
      this._afterCountQuiz = null;
      this.dismissCountQuiz();
    });
    document.body.addEventListener('click', (e) => {
      const tip = e.target.closest('.info-tip');
      if (!tip) return;
      e.stopPropagation();
      const text = tip.dataset.tipText || tip.getAttribute('title') || '';
      if (!text) return;
      let panel = tip.nextElementSibling;
      if (!panel?.classList?.contains('info-tip-panel')) {
        panel = document.createElement('div');
        panel.className = 'info-tip-panel';
        panel.setAttribute('role', 'tooltip');
        tip.parentElement?.appendChild(panel);
      }
      panel.textContent = text;
      panel.hidden = !panel.hidden;
    });
    this.bindClick('btn-handend-count-quiz', () => {
      if (this.phase !== 'handEnd') return;
      this._handendQuizOptional = false;
      this.openCountQuizModal();
      const btn = document.getElementById('btn-handend-count-quiz');
      if (btn) btn.classList.add('hidden');
    });
    this.bindClick('btn-next-hand', () => {
      if (this.phase !== 'handEnd') return;
      if (this.sessionMode === 'tournament') {
        const m = this.save.tournament?.match;
        if (m && m.handsPlayed >= TOURNAMENT_HANDS_PER_MATCH) {
          this.resolveTournamentMatch();
          return;
        }
      }
      this.beginBetPhase();
    });
    this.bindClick('btn-end-session', () => this.endSession());
    this.bindClick('btn-help-settings', () => this.openSettings());
    this.bindClick('btn-settings-close', () => document.getElementById('modal-settings').close());
    this.bindClick('btn-save-external-config', () => this.saveExternalConfigFromSettings());
    this.bindClick('btn-toggle-stats', () => this.toggleStatsSidebar(true));
    this.bindClick('btn-menu-stats', () => this.toggleStatsSidebar(true));
    this.bindClick('btn-close-stats', () => this.toggleStatsSidebar(false));
    document.getElementById('stats-backdrop')?.addEventListener('click', () => this.toggleStatsSidebar(false));
    this.bindClick('btn-chart', () => {
      if (!this.help.allowChart()) { this.toast('Chart disabled at this level'); return; }
      document.getElementById('chart-content').textContent =
        buildStrategyChartContent(this.rules, this.activeCountingSystem());
      document.getElementById('modal-chart').showModal();
    });
    this.bindClick('btn-chart-close', () => document.getElementById('modal-chart').close());
    this.bindClick('btn-shoe-close', () => document.getElementById('modal-shoe').close());
    this.bindClick('btn-quit', () => { this.save.sessionActive = true; this.persist(); this.endSession(); });
    document.getElementById('table-tier-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-table-tier]');
      if (!btn || btn.disabled) return;
      Sounds.init();
      this.joinTable(btn.dataset.tableTier);
    });
    this.bindClick('btn-table-lobby-back', () => this.goMenu());
    this.bindClick('btn-tournament-back', () => this.goMenu());
    this.bindClick('btn-special-event-back', () => this.goMenu());
    this.bindClick('btn-clubs-back', () => this.goMenu());
    this.bindClick('btn-club-create-submit', () => this.submitCreateClub());
    this.bindClick('btn-club-create-cancel', () => this.hideClubCreateForm());
    this.bindClick('btn-club-edit-save', () => this.submitEditClub());
    this.bindClick('btn-club-edit-cancel', () => this.hideClubEditForm());
    const clubClickRoot = document.getElementById('clubs-main-view');
    clubClickRoot?.addEventListener('click', (e) => {
      if (e.target.closest('#btn-club-create-open')) { e.preventDefault(); this.showClubCreateForm(); return; }
      if (e.target.closest('#btn-club-edit-open')) { e.preventDefault(); this.showClubEditForm(); return; }
      if (e.target.closest('#btn-club-leave')) { e.preventDefault(); this.leaveCurrentClub(); return; }
      if (e.target.closest('#btn-club-invite-join')) { e.preventDefault(); this.joinClubByInviteAction(); return; }
      if (e.target.closest('#btn-club-chat-send')) { e.preventDefault(); this.submitClubChat(); return; }
      if (e.target.closest('#btn-club-announcement-post')) { e.preventDefault(); this.submitClubAnnouncement(); return; }
      const react = e.target.closest('[data-club-react]');
      if (react) {
        e.preventDefault();
        this.reactClubChat(react.dataset.clubReact, react.dataset.clubEmoji);
        return;
      }
      const promote = e.target.closest('[data-club-promote]');
      if (promote) { e.preventDefault(); this.clubManageAction('promote', promote.dataset.clubPromote); return; }
      const demote = e.target.closest('[data-club-demote]');
      if (demote) { e.preventDefault(); this.clubManageAction('demote', demote.dataset.clubDemote); return; }
      const kick = e.target.closest('[data-club-kick]');
      if (kick) { e.preventDefault(); this.clubManageAction('kick', kick.dataset.clubKick); return; }
      const transfer = e.target.closest('[data-club-transfer]');
      if (transfer) { e.preventDefault(); this.clubManageAction('transfer', transfer.dataset.clubTransfer); return; }
      const joinBtn = e.target.closest('[data-join-club]');
      if (joinBtn && !joinBtn.disabled) this.joinClubById(joinBtn.dataset.joinClub);
    });
    document.getElementById('club-chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.submitClubChat(); }
    });
    this.bindClick('btn-practice-back', () => this.goMenu());
    this.bindClick('btn-campaign-back', () => this.goMenu());
    this.bindClick('btn-daily-back', () => this.goMenu());
    this.bindClick('btn-daily-rewards-back', () => this.goMenu());
    this.bindClick('btn-daily-reward-claim', () => this.claimDailyLoginFromModal());
    this.bindClick('btn-daily-training-start', () => {
      const launch = document.getElementById('btn-daily-training-start')?.dataset.launch
        || this.dailyTrainingGoal?.launch;
      if (launch) this.launchTrainingDrill(launch);
    });
    document.getElementById('screen-tutorial')?.addEventListener('click', (e) => {
      if (this.phase !== 'tutorial') return;
      if (e.target.closest('#btn-tutorial-back')) { e.preventDefault(); this.tutorialBack(); return; }
      if (e.target.closest('#btn-tutorial-next')) { e.preventDefault(); this.tutorialNext(); return; }
      if (e.target.closest('#btn-tutorial-skip')) { e.preventDefault(); this.skipTutorial(); }
    });
    this.bindClick('btn-daily-start', () => this.startSession(false, 'daily'));
    this.bindClick('btn-drill-count-deal', () => { Sounds.init(); this.drillCountDeal(); });
    this.bindClick('btn-drill-count-finish', () => this.drillCountFinish());
    this.bindClick('btn-drill-count-quit', () => { this.save.sessionActive = false; this.phase = 'practice-range'; this.render(); });
    this.bindClick('btn-speed-drill-start', () => this.startSpeedDrillRound());
    this.bindClick('btn-speed-drill-pause', () => this.speedDrillTogglePause());
    this.bindClick('btn-speed-drill-skip-quiz', () => this.speedDrillFinishDealing());
    this.bindClick('btn-speed-drill-submit', () => this.submitSpeedDrillGuess(document.getElementById('speed-drill-guess')?.value));
    this.bindClick('btn-speed-drill-quit', () => {
      this.speedDrillCleanupTimer();
      this.save.sessionActive = false;
      this.save.sessionDrill = null;
      this.phase = this.save.sessionMode === 'training' ? 'training' : 'practice-range';
      this.persist();
      this.render();
    });
    this.bindClick('btn-burst-drill-start', () => this.startCardBurstRound());
    this.bindClick('btn-burst-drill-submit', () => this.submitCardBurstGuess(document.getElementById('burst-drill-guess')?.value));
    this.bindClick('btn-burst-drill-quit', () => {
      this.burstDrillCleanupTimer();
      this.save.sessionActive = false;
      this.save.sessionDrill = null;
      this.phase = this.save.sessionMode === 'training' ? 'training' : 'practice-range';
      this.persist();
      this.render();
    });
    this.bindClick('btn-decks-drill-start', () => this.startDecksLeftRound());
    this.bindClick('btn-decks-drill-submit', () => this.submitDecksLeftGuess(document.getElementById('decks-drill-guess')?.value));
    this.bindClick('btn-decks-drill-quit', () => {
      this.save.sessionActive = false;
      this.save.sessionDrill = null;
      this.phase = this.save.sessionMode === 'training' ? 'training' : 'practice-range';
      this.persist();
      this.render();
    });
    this.bindClick('btn-tc-drill-start', () => this.startTrueCountDrillRound());
    this.bindClick('btn-tc-drill-submit', () => this.submitTrueCountDrillGuess(document.getElementById('tc-drill-guess')?.value));
    this.bindClick('btn-tc-drill-quit', () => {
      this.save.sessionActive = false;
      this.save.sessionDrill = null;
      this.phase = this.save.sessionMode === 'training' ? 'training' : 'practice-range';
      this.persist();
      this.render();
    });
    document.getElementById('tc-drill-guess')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitTrueCountDrillGuess(e.target.value);
      }
    });
    this.bindClick('btn-index-drill-start', () => this.startIndexPlayDrillRound());
    this.bindClick('btn-index-drill-quit', () => {
      this.save.sessionActive = false;
      this.save.sessionDrill = null;
      this.phase = this.save.sessionMode === 'training' ? 'training' : 'practice-range';
      this.persist();
      this.render();
    });
    this.bindClick('btn-bet-spread-start', () => this.startBetSpreadDrillRound());
    document.getElementById('bet-spread-preset')?.addEventListener('change', (e) => {
      document.getElementById('bet-spread-custom-range')?.classList.toggle('hidden', e.target.value !== 'custom');
    });
    this.bindClick('btn-bet-spread-quit', () => {
      this.betSpreadClearTimer();
      this.save.sessionActive = false;
      this.save.sessionDrill = null;
      this.phase = this.save.sessionMode === 'training' ? 'training' : 'practice-range';
      this.persist();
      this.render();
    });
    document.getElementById('speed-drill-guess')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitSpeedDrillGuess(e.target.value);
      }
    });
    this.bindClick('btn-continue-session', () => {
      if (!this.save.sessionActive) {
        this.toast('No saved session to continue', 'error');
        return;
      }
      lobbyTapFeedback('whoosh');
      this.continueSession();
    });
    this.bindClick('btn-export-stats', () => this.exportStats());
    this.bindClick('btn-reset-progress-sidebar', () => this.openResetDialog());
    this.bindClick('btn-reset-cancel', () => document.getElementById('modal-reset').close());
    this.bindClick('btn-reset-confirm', () => this.confirmResetProgress());
    document.addEventListener('keydown', (e) => {
      if (this.phase === 'tutorial') {
        if (document.body.classList.contains('stats-open')) {
          if (e.key === 'Escape') { e.preventDefault(); this.toggleStatsSidebar(false); }
          return;
        }
        if (!this.canTutorialNav()) return;
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          e.preventDefault();
          this.tutorialNext();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Escape') {
          e.preventDefault();
          this.tutorialBack();
        }
        return;
      }
      if (e.key === 'Escape' && document.body.classList.contains('stats-open')) {
        this.toggleStatsSidebar(false);
        return;
      }
      if (this.phase !== 'playing') return;
      const m = { h:'hit', s:'stand', d:'double', p:'split' };
      if (m[e.key.toLowerCase()]) this.playerAction(m[e.key.toLowerCase()]);
    });
  }

  renderCard(c, hidden = false, animIndex = null) {
    const animStyle = animIndex != null ? ` style="--deal-i:${animIndex}"` : '';
    const animCls = animIndex != null ? ' deal-anim dealt' : '';
    if (hidden) {
      const flip = this.revealHoleAnim ? ' flip-reveal' : '';
      return `<div class="playing-card back hole-hidden${animCls}${flip}"${animStyle}><div class="card-inner"></div></div>`;
    }
    const red = c.suit === 'H' || c.suit === 'D';
    const sym = SUIT_SYM[c.suit];
    const cls = red ? 'red' : '';
    const rankCls = c.rank === '10' ? ' rank-10' : '';
    return `<div class="playing-card ${cls}${rankCls}${animCls}"${animStyle}>
      <div class="corner corner-tl"><span>${c.rank}</span><span>${sym}</span></div>
      <div class="center-suit">${sym}</div>
      <div class="corner corner-br"><span>${c.rank}</span><span>${sym}</span></div>
    </div>`;
  }

  /** HUD tiles: system-aware RC / TC or KO key, decks left, cards counted. */
  renderCountBoxes(showCountHud, shoe) {
    if (!this.wantsCountDisplay()) return '';
    if (!showCountHud) {
      return `<div class="col-span-2 sm:col-span-4 text-center py-3 rounded-xl bg-black/30 border border-emerald-800/30 count-hidden text-emerald-400/60 text-sm">
        🔒 Count hidden — trust your training (${countingSystemLabel(this.activeCountingSystem())})
      </div>`;
    }
    const i = this.counter.getCountSnapshot(shoe);
    const sys = COUNTING_SYSTEMS[i.systemId] || COUNTING_SYSTEMS['hi-lo'];
    const rs = i.runningCount >= 0 ? `+${i.runningCount}` : `${i.runningCount}`;
    const box = (label, val, sub, key = '', tip = '') =>
      `<div class="text-center py-2 px-3 rounded-xl bg-black/35 border border-emerald-700/25" ${key ? `data-count="${key}"` : ''}>
        <div class="text-[10px] uppercase tracking-wider text-emerald-400/60 flex items-center justify-center gap-1">${label}${tip ? infoTipButton(tip, `About ${label}`) : ''}</div>
        <div class="font-mono font-bold text-lg text-emerald-200">${val}</div>
        <div class="text-[10px] text-emerald-500/50">${sub}</div>
      </div>`;
    if (sys.balanced) {
      const ts = i.trueCount >= 0 ? `+${i.trueCount.toFixed(1)}` : i.trueCount.toFixed(1);
      return box('Running Count', rs, 'your count this round', 'running', TIP_RUNNING_COUNT)
        + box('True Count', ts, 'count ÷ decks left', 'true', TIP_TRUE_COUNT)
        + box('Decks Left', i.decksRemaining.toFixed(2), 'still in shoe', 'decks', TIP_DECKS_LEFT)
        + box('Cards Counted', i.cardsCounted, 'seen this round', 'seen', TIP_CARDS_COUNTED);
    }
    const vs = i.abovePivot >= 0 ? `+${i.abovePivot}` : `${i.abovePivot}`;
    return box('Running Count', rs, 'your count this round', 'running', TIP_RUNNING_COUNT)
      + box('Key Count', `+${i.pivot}`, 'betting starts here', 'pivot', TIP_KEY_COUNT)
      + box('Above Key', vs, 'how far above key', 'above', TIP_ABOVE_KEY)
      + box('Cards Counted', i.cardsCounted, 'seen this round', 'seen', TIP_CARDS_COUNTED);
  }

  renderStatsSidebar() {
    const s = this.stats;
    const pb = this.save.personalBests || defaultPersonalBests();
    const ranks = ['Novice','Apprentice','Journeyman','Expert','Master'];
    const ca = calculateCountAccuracyPercent(s).toFixed(1), da = calculateStrategyAccuracyPercent(s).toFixed(1), ra = calculateRecentCountAccuracyPercent(s).toFixed(1);
    const session = this.session;
    const unlocked = unlockedAchievementIds(this.save);
    const achHtml = ACHIEVEMENTS.map(a => {
      const on = unlocked.has(a.id);
      return `<div class="achievement-badge ${on ? 'unlocked' : 'locked'} flex items-center gap-2 p-2 rounded-lg ${on ? 'bg-amber-950/30 border border-amber-600/20' : 'bg-black/20'}" title="${a.desc}">
        <span class="text-lg">${a.icon}</span>
        <div class="min-w-0"><div class="text-xs font-medium truncate ${on ? 'text-amber-200' : 'text-emerald-500/50'}">${a.name}</div></div>
      </div>`;
    }).join('');
    const milestone = nextMilestone(this.save);
    const body = document.getElementById('stats-sidebar-body');
    if (this.phase === 'menu' && !s.handsPlayed) {
      body.innerHTML = `
        <p class="text-emerald-400/70 text-sm">Your stats, personal bests, and achievements appear here as you play.</p>
        <div class="rounded-xl bg-emerald-900/20 border border-emerald-700/20 p-3 text-xs text-emerald-500/60">
          Everything saves automatically to <strong class="text-emerald-300">localStorage</strong> in this browser — bankroll, help level, unlocks, and more.
        </div>
        <div class="rounded-xl bg-amber-950/30 border border-amber-700/20 p-3 text-xs text-amber-100/80">
          <strong class="text-gold">Tip:</strong> ${milestone}
        </div>`;
      return;
    }
    body.innerHTML = `
      <div class="rounded-xl bg-emerald-900/30 border border-emerald-700/20 p-3">
        <div class="text-gold font-bold text-lg">${ranks[s.rank]}</div>
        <div class="text-emerald-400/70 text-xs">Help Level ${s.helpLevel} · ${HELP_LABELS[s.helpLevel]}</div>
        <div class="text-[10px] text-emerald-500/50 mt-1">Bankroll: $${this.bankroll.toLocaleString()}</div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="bg-black/25 rounded-lg p-2 text-center"><div class="text-2xl font-bold text-emerald-300">${s.handsPlayed}</div><div class="text-[10px] text-emerald-500/60">Hands</div></div>
        <div class="bg-black/25 rounded-lg p-2 text-center"><div class="text-2xl font-bold text-emerald-300">${unlocked.size}/${ACHIEVEMENTS.length}</div><div class="text-[10px] text-emerald-500/60">Achievements</div></div>
      </div>
      <div class="space-y-2">
        <div class="flex justify-between"><span class="text-emerald-400/70">Count accuracy</span><span class="font-mono text-cyan-300">${ca}%</span></div>
        <div class="h-1.5 bg-black/40 rounded-full"><div class="h-full bg-cyan-500 rounded-full" style="width:${Math.min(100, ca)}%"></div></div>
        <div class="flex justify-between"><span class="text-emerald-400/70">Strategy accuracy</span><span class="font-mono text-cyan-300">${da}%</span></div>
        <div class="h-1.5 bg-black/40 rounded-full"><div class="h-full bg-cyan-500 rounded-full" style="width:${Math.min(100, da)}%"></div></div>
        <div class="flex justify-between text-xs"><span class="text-emerald-500/60">Recent count (50)</span><span class="font-mono">${ra}%</span></div>
      </div>
      <div class="rounded-xl bg-black/25 border border-white/5 p-3 space-y-2">
        <div class="text-[10px] uppercase tracking-wider text-gold/80">Personal Bests</div>
        <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          <span class="text-emerald-500/60">Win streak</span><span class="font-mono text-right text-amber-200">${pb.longestWinStreak}</span>
          <span class="text-emerald-500/60">Best bankroll</span><span class="font-mono text-right text-amber-200">$${Math.max(pb.bestBankroll, s.bestBankroll).toLocaleString()}</span>
          <span class="text-emerald-500/60">Best session</span><span class="font-mono text-right text-amber-200">+$${pb.bestSessionProfit}</span>
          <span class="text-emerald-500/60">Peak count %</span><span class="font-mono text-right text-amber-200">${pb.bestCountAccuracy.toFixed(1)}%</span>
          <span class="text-emerald-500/60">Peak strategy %</span><span class="font-mono text-right text-amber-200">${pb.bestDecisionAccuracy.toFixed(1)}%</span>
          <span class="text-emerald-500/60">Perfect shoes</span><span class="font-mono text-right text-amber-200">${pb.perfectShoeCounts || 0}</span>
        </div>
      </div>
      ${session ? `<div class="rounded-lg bg-black/25 p-3 text-xs space-y-1">
        <div class="text-emerald-400/70 uppercase tracking-wider text-[10px]">This session</div>
        <div>Hands: ${session.hands} · Streak: ${s.winStreak || 0}</div>
        <div class="${session.netPL >= 0 ? 'text-green-400' : 'text-red-400'}">Net P/L: ${session.netPL >= 0 ? '+' : ''}$${session.netPL}</div>
      </div>` : ''}
      <div class="rounded-xl bg-amber-950/20 border border-amber-700/15 p-3 text-xs text-amber-100/80">
        <span class="text-gold font-medium">Next:</span> ${milestone}
      </div>
      <details class="rounded-xl border border-white/10 overflow-hidden">
        <summary class="px-3 py-2 text-xs font-semibold text-emerald-300 cursor-pointer">Achievements (${unlocked.size}/${ACHIEVEMENTS.length})</summary>
        <div class="p-2 space-y-1 max-h-48 overflow-y-auto">${achHtml}</div>
      </details>`;
    if (this.save.lastSavedAt) {
      const el = document.getElementById('save-status');
      if (el) el.textContent = 'Last saved ' + new Date(this.save.lastSavedAt).toLocaleString();
    }
  }

  openSettings() {
    document.getElementById('toggle-sound').checked = Sounds.enabled;
    document.getElementById('toggle-count-display').checked = this.wantsCountDisplay();
    document.getElementById('toggle-count-popups').checked = this.settings.showCountPopups !== false;
    const indexToggle = document.getElementById('toggle-index-deviations');
    if (indexToggle) indexToggle.checked = this.usesIndexDeviations();
    const syncDisplay = () => {
      this.save.settings.showCountDisplay = document.getElementById('toggle-count-display').checked;
      this.save.settings.showCountPopups = document.getElementById('toggle-count-popups').checked;
      if (indexToggle) this.save.settings.useIndexDeviations = indexToggle.checked;
      this.persist();
      this.render();
    };
    document.getElementById('toggle-count-display').onchange = syncDisplay;
    document.getElementById('toggle-count-popups').onchange = syncDisplay;
    if (indexToggle) indexToggle.onchange = syncDisplay;
    const unlocks = new Set(this.save.countingUnlocks || ['hi-lo']);
    const activeSys = this.activeCountingSystem();
    const sysContainer = document.getElementById('counting-system-cards');
    sysContainer.innerHTML = Object.values(COUNTING_SYSTEMS).map(sys => {
      const locked = !unlocks.has(sys.id);
      const selected = sys.id === activeSys;
      return `<button type="button" class="counting-system-card w-full text-left p-3 rounded-xl border border-white/10 transition ${selected ? 'selected' : ''} ${locked ? 'locked' : 'hover:border-emerald-500/40'}" data-sys="${sys.id}" ${locked ? 'disabled' : ''}>
        <div class="font-bold text-sm flex items-center justify-between gap-2">
          <span class="${selected ? 'text-emerald-300' : 'text-emerald-100'}">${sys.name}</span>
          ${locked ? '<span class="text-[10px] text-emerald-500/50">🔒 Locked</span>' : selected ? '<span class="text-[10px] text-emerald-400">Active</span>' : ''}
        </div>
        <div class="text-xs text-emerald-400/70 mt-1">${locked ? sys.unlockHint : sys.betHint}</div>
      </button>`;
    }).join('');
    sysContainer.querySelectorAll('[data-sys]').forEach(btn => {
      btn.onclick = () => {
        if (btn.disabled) return;
        this.setCountingSystem(btn.dataset.sys);
        this.openSettings();
      };
    });
    const container = document.getElementById('help-level-cards');
    const banner = this.help.modeHint();
    container.innerHTML = (banner ? `<p class="text-xs text-cyan-300/80 mb-2 p-2 rounded-lg bg-cyan-950/30 border border-cyan-700/20">${banner}</p>` : '')
      + HELP_LABELS.map((label, i) => `
      <button class="help-level-card w-full text-left p-3 rounded-xl border border-white/10 hover:border-amber-500/40 transition ${i === this.help.level ? 'selected' : ''}" data-lvl="${i}">
        <div class="font-bold text-sm"><span class="text-gold">Level ${i}</span> — ${label}</div>
        <div class="text-xs text-emerald-400/70 mt-1">${HELP_DESC[i]}</div>
      </button>`).join('');
    container.querySelectorAll('[data-lvl]').forEach(btn => btn.onclick = () => {
      this.setHelpLevel(+btn.dataset.lvl);
      this.openSettings();
    });
    const r = this.rules;
    const rulesEl = document.getElementById('rules-toggles');
    rulesEl.innerHTML = `
      <label class="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/10 cursor-pointer">
        <span>6:5 Blackjack (pays 1.2×)</span>
        <input type="checkbox" id="rule-65" class="w-5 h-5 accent-amber-500" ${r.blackjackPayout < 1.5 ? 'checked' : ''} />
      </label>
      <label class="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/10 cursor-pointer">
        <span>Double After Split (DAS)</span>
        <input type="checkbox" id="rule-das" class="w-5 h-5 accent-amber-500" ${r.das ? 'checked' : ''} />
      </label>
      <label class="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/10 cursor-pointer">
        <span>Late Surrender</span>
        <input type="checkbox" id="rule-surrender" class="w-5 h-5 accent-amber-500" ${r.lateSurrender ? 'checked' : ''} />
      </label>
      <label class="flex items-center justify-between p-3 rounded-xl bg-black/25 border border-white/10 cursor-pointer">
        <span>Dealer Hits Soft 17</span>
        <input type="checkbox" id="rule-h17" class="w-5 h-5 accent-amber-500" ${r.dealerHitsSoft17 ? 'checked' : ''} />
      </label>`;
    const syncRules = () => {
      this.setRules({
        blackjackPayout: document.getElementById('rule-65').checked ? 1.2 : 1.5,
        das: document.getElementById('rule-das').checked,
        lateSurrender: document.getElementById('rule-surrender').checked,
        dealerHitsSoft17: document.getElementById('rule-h17').checked,
      });
      this.updateSettingsAdvisory();
    };
    ['rule-65','rule-das','rule-surrender','rule-h17'].forEach(id => {
      document.getElementById(id).onchange = syncRules;
    });
    this.updateSettingsAdvisory();
    this.loadExternalConfigIntoSettings();
    document.getElementById('modal-settings').showModal();
  }

  toggleStatsSidebar(open) {
    const el = document.getElementById('stats-sidebar');
    const backdrop = document.getElementById('stats-backdrop');
    el.classList.toggle('open', open);
    el.classList.toggle('translate-x-full', !open);
    if (backdrop) {
      backdrop.classList.toggle('visible', open);
      backdrop.classList.toggle('hidden', !open);
      backdrop.setAttribute('aria-hidden', String(!open));
    }
    document.body.classList.toggle('stats-open', open);
  }

  render() {
    const menu = document.getElementById('screen-menu');
    const casinoPlay = document.getElementById('screen-casino-play');
    const betPanel = document.getElementById('screen-bet');
    const handend = document.getElementById('screen-handend');
    const header = document.getElementById('app-header');
    const actionBar = document.getElementById('action-bar');
    const subScreens = ['screen-training','screen-training-history','screen-training-mistakes','screen-drill-session-summary','screen-practice-range','screen-tutorial','screen-campaign','screen-daily','screen-daily-rewards','screen-table-lobby','screen-tournament','screen-special-event','screen-dealer-mode','screen-clubs','screen-drill-count','screen-drill-speed','screen-drill-true-count','screen-drill-index','screen-drill-bet-spread','screen-drill-card-burst','screen-drill-decks-left'];

    const inGame = ['bet','countConfirm','playing','handEnd'].includes(this.phase);
    const atTable = ['bet','playing','countConfirm','handEnd'].includes(this.phase);
    header.classList.toggle('hidden', !inGame);
    const allDone = this.playerHands.length > 0 && this.playerHands.every(h => h.finished) && this.activeIdx >= this.playerHands.length;
    const showBetRail = this.phase === 'bet' || this.phase === 'countConfirm';
    const showPlayActions = this.phase === 'playing' && !allDone;
    document.documentElement.classList.toggle('casino-play-active', atTable);
    document.body.classList.toggle('casino-play-active', atTable);
    document.body.classList.toggle('casino-handend-active', this.phase === 'handEnd');
    document.body.classList.toggle('casino-bet-active', showBetRail);
    document.body.classList.toggle('casino-action-bar-visible', showPlayActions);
    actionBar.classList.toggle('hidden', !showPlayActions);
    document.getElementById('casino-felt-bet-rail')?.classList.toggle('hidden', !showBetRail);

    menu.classList.toggle('hidden', this.phase !== 'menu');
    casinoPlay?.classList.toggle('hidden', !atTable);
    betPanel?.classList.toggle('bet-phase-visible', showBetRail);
    document.getElementById('count-hud-bet')?.classList.toggle('hidden', this.phase !== 'bet' && this.phase !== 'countConfirm');
    document.getElementById('count-hud')?.classList.toggle('hidden', this.phase !== 'playing');
    handend?.classList.toggle('hidden', this.phase !== 'handEnd');
    handend?.classList.toggle('casino-handend-overlay', this.phase === 'handEnd');
    subScreens.forEach(id => {
      const el = document.getElementById(id);
      const key = id.replace('screen-','');
      el.classList.toggle('hidden', this.phase !== key);
    });

    if (this.phase === 'menu') this.renderMenu();
    else if (!window.__CQ_TEST_MODE) stopLobbyPassTimer();
    if (this.phase === 'training') this.renderTrainingMode();
    if (this.phase === 'training-history') this.renderTrainingHistory();
    if (this.phase === 'training-mistakes') this.renderMistakeReview();
    if (this.phase === 'drill-session-summary') this.renderDrillSessionSummary();
    if (this.phase === 'practice-range') this.renderPracticeRange();
    if (this.phase === 'bet' || this.phase === 'countConfirm') { this.renderBet(); this.renderCasinoSeats(); }
    if (this.phase === 'playing') { this.renderTable(); this.renderCasinoSeats(); }
    if (this.phase === 'handEnd') { this.renderTable(); this.renderHandEnd(); this.renderCasinoSeats(); }
    if (this.phase === 'drill-count') this.renderDrillCount();
    if (this.phase === 'drill-speed') this.renderSpeedDrill();
    if (this.phase === 'drill-card-burst') this.renderCardBurstDrill();
    if (this.phase === 'drill-decks-left') this.renderDecksLeftDrill();
    if (this.phase === 'drill-true-count') this.renderTrueCountDrill();
    if (this.phase === 'drill-index') this.renderIndexPlayDrill();
    if (this.phase === 'drill-bet-spread') this.renderBetSpreadDrill();
    if (this.phase === 'tutorial') this.renderTutorial();
    if (this.phase === 'campaign') this.renderCampaign();
    if (this.phase === 'daily') this.renderDaily();
    if (this.phase === 'daily-rewards') this.renderDailyRewards();
    if (this.phase === 'table-lobby') this.renderTableLobby();
    if (this.phase === 'tournament') this.renderTournament();
    if (this.phase === 'special-event') this.renderSpecialEvent();
    if (this.phase === 'dealer-mode') this.renderDealerMode();
    if (this.phase === 'clubs') this.renderClubs();

    if (this._lastPhase !== this.phase) {
      const screenId = PHASE_SCREEN_IDS[this.phase];
      if (screenId) {
        const screenEl = document.getElementById(screenId);
        if (screenEl) {
          screenEl.classList.remove('screen-enter');
          void screenEl.offsetWidth;
          screenEl.classList.add('screen-enter');
        }
      }
      this._lastPhase = this.phase;
    }

    this.renderStatsSidebar();

    if (inGame) {
      document.getElementById('header-mode').textContent = this.modeLabel() + (this.practice ? ' — ∞ chips' : '');
      this.renderCurrencyDisplays();
      const mh = this.help.modeHint();
      document.getElementById('header-help-label').textContent = mh
        ? `${HELP_LABELS[this.help.level]} · ${mh.split('—')[0].trim()}`
        : `Level ${this.help.level} · ${HELP_LABELS[this.help.level]}`;
      if (this.shoe) {
        const pct = Math.round(this.shoe.remainingFraction() * 100);
        document.getElementById('shoe-bar-fill').style.width = pct + '%';
        document.getElementById('shoe-bar-label').textContent = pct + '%';
      }
      document.getElementById('btn-chart').classList.toggle('hidden', !this.help.allowChart());
    }
    if (atTable) {
      this.syncCasinoShellMetrics();
      requestAnimationFrame(() => this.syncCasinoShellMetrics());
    }
  }

  renderMenu() {
    this.renderLobby();
    if (!window.__CQ_TEST_MODE) startLobbyPassTimer(this);
  }

  renderLobbyPlayButton(m, secondary = false) {
    const cls = secondary ? `lobby-play-secondary ${m.cls}` : 'lobby-hero-play';
    const aria = `${m.title} — ${m.sub}`;
    if (!secondary) {
      return `<button type="button" id="lobby-hero-play" class="${cls}" data-lobby-play="${m.action}" title="${m.sub}" aria-label="${aria}">
        <span class="hero-icon" aria-hidden="true">${m.icon}</span>
        <span class="hero-title">${m.title}</span>
        <span class="hero-sub">${m.sub}</span>
      </button>`;
    }
    return `<button type="button" class="${cls} w-full text-white" data-lobby-play="${m.action}" aria-label="${aria}">
      <div class="play-title">${m.title}</div>
      <div class="play-sub">${m.sub}</div>
      <span class="play-icon" aria-hidden="true">${m.icon}</span>
    </button>`;
  }

  renderLobby() {
    this.renderCurrencyDisplays();
    const s = this.save;
    const st = s.stats;
    const has = !!Storage.load();
    const w = formatWalletShort(s);
    const rankName = ['Novice','Apprentice','Journeyman','Expert','Master'][st.rank] || 'Novice';
    const level = playerLobbyLevel(s);
    const xp = playerLobbyXpProgress(s);
    const name = (st.playerName || 'Player').trim().slice(0, 14) || 'Player';

    const lobbyChips = document.getElementById('lobby-chips');
    const lobbyGems = document.getElementById('lobby-gems');
    if (lobbyChips) {
      bumpCurrencyEl(lobbyChips, w.chips);
      lobbyChips.textContent = w.chips;
    }
    if (lobbyGems) {
      bumpCurrencyEl(lobbyGems, w.gems);
      lobbyGems.textContent = w.gems;
    }

    const avatar = document.getElementById('lobby-profile-avatar');
    if (avatar) avatar.textContent = name.slice(0, 2).toUpperCase();
    const lvl = document.getElementById('lobby-profile-level');
    if (lvl) lvl.textContent = String(level);
    const xpFill = document.getElementById('lobby-xp-fill');
    if (xpFill) xpFill.style.width = `${xp.pct}%`;
    const xpBar = document.getElementById('lobby-xp-bar');
    if (xpBar) xpBar.title = `XP ${xp.current}/${xp.next} to level ${level + 1}`;
    const pname = document.getElementById('lobby-profile-name');
    if (pname) pname.textContent = name;
    const prank = document.getElementById('lobby-profile-rank');
    if (prank) prank.textContent = `${rankName} · Help Level ${st.helpLevel}`;

    const clubsBtn = document.getElementById('lobby-clubs-btn');
    const clubsSub = document.getElementById('lobby-clubs-sub');
    const club = getPlayerClub(this.save);
    if (clubsBtn) {
      clubsBtn.classList.toggle('has-crew', !!club);
      clubsBtn.title = club ? `${club.name} — Counting Crews` : 'Counting Crews — create or join';
      const existingBadge = clubsBtn.querySelector('.lobby-clubs-badge');
      if (existingBadge) existingBadge.remove();
      if (club?._pendingPlayerPayout) {
        const b = document.createElement('span');
        b.className = 'lobby-clubs-badge';
        b.title = 'Weekly payout ready';
        clubsBtn.appendChild(b);
      }
    }
    if (clubsSub) {
      if (club) {
        const board = getClubWeeklyLeaderboard(club);
        const rank = board.findIndex(m => m.id === this.save.playerId) + 1;
        const pts = board.find(m => m.id === this.save.playerId)?.weekly?.points ?? 0;
        clubsSub.textContent = rank > 0 ? `#${rank} · ${pts}pts` : club.name.slice(0, 10);
      } else clubsSub.textContent = 'Join a crew';
    }

    ensureDailyRewardsCurrent(this.save);
    const passLabel = document.getElementById('lobby-pass-label');
    const passTimer = document.getElementById('lobby-pass-timer');
    if (passLabel) {
      passLabel.textContent = isVipActive(this.save)
        ? '👑 VIP Active — 2× rewards · +10% wins'
        : 'Unlock CountQuest Pass — 2× daily · VIP perks';
    }
    if (passTimer) passTimer.textContent = formatPassCountdownLive(this.save);

    const navIcons = document.getElementById('lobby-nav-icons');
    if (navIcons) {
      const rewardReady = canClaimDailyLogin(this.save);
      navIcons.innerHTML = LOBBY_NAV_ITEMS.map(item => {
        const cls = `lobby-nav-icon-btn${item.badge === 'reward' && rewardReady ? ' has-badge' : ''}`;
        return `<button type="button" class="${cls}" data-lobby-nav="${item.action}" title="${item.title || item.label}">
          <span class="lobby-nav-icon">${item.icon}</span>
          <span>${item.label}</span>
          ${item.badge === 'reward' && rewardReady ? '<span class="lobby-nav-badge"></span>' : ''}
        </button>`;
      }).join('');
    }

    const modeById = Object.fromEntries(LOBBY_PLAY_MODES.map(m => [m.id, m]));
    const heroSlot = document.getElementById('lobby-hero-play-slot');
    if (heroSlot) heroSlot.innerHTML = this.renderLobbyPlayButton(LOBBY_HERO_PLAY, false);
    const leftCol = document.getElementById('lobby-secondary-left');
    if (leftCol) {
      leftCol.innerHTML = LOBBY_SECONDARY_LEFT.map(id => {
        const m = modeById[id];
        if (!m) return '';
        if (id === 'event') {
          const ev = getCurrentSpecialEvent();
          return this.renderLobbyPlayButton({
            ...m,
            sub: `${ev.icon} ${ev.name} · ${formatSpecialEventCountdown()} left`,
          }, true);
        }
        return this.renderLobbyPlayButton(m, true);
      }).join('');
    }
    const rightCol = document.getElementById('lobby-secondary-right');
    if (rightCol) {
      rightCol.innerHTML = LOBBY_SECONDARY_RIGHT.map(id => modeById[id]).filter(Boolean)
        .map(m => this.renderLobbyPlayButton(m, true)).join('');
    }

    const playGrid = document.getElementById('lobby-play-grid');
    if (playGrid) {
      playGrid.innerHTML = LOBBY_PLAY_MODES.map(m =>
        `<button type="button" data-lobby-play="${m.action}" data-mode-id="${m.id}"></button>`
      ).join('');
    }

    const mgRow = document.getElementById('lobby-minigames-row');
    if (mgRow) {
      mgRow.innerHTML = LOBBY_MINIGAMES.map(mg => {
        const ready = canPlayLobbyMinigame(this.save, mg.key);
        return `<button type="button" class="lobby-minigame-tile w-full ${ready ? 'ready' : ''}" data-lobby-minigame="${mg.id}">
          <span class="mg-icon">${mg.icon}</span>
          <span class="mg-label">${mg.label}</span>
          <span class="mg-status">${ready ? 'FREE today' : 'Come back tomorrow'}</span>
        </button>`;
      }).join('');
    }

    const achCount = unlockedAchievementIds(this.save).size;
    document.getElementById('menu-save-info').textContent = has
      ? `Saved locally · ${st.handsPlayed} hands · ${achCount} trophies · ${THEMES[s.settings.theme]?.name || 'Classic'} table`
      : 'No saved progress yet — your first session will auto-save';
    const hint = document.getElementById('menu-beginner-hint');
    hint.classList.toggle('hidden', st.handsPlayed >= 10);
    const achPrev = document.getElementById('menu-achievements-preview');
    if (achCount > 0) {
      achPrev.classList.remove('hidden');
      achPrev.textContent = `🏆 ${achCount} of ${ACHIEVEMENTS.length} achievements unlocked`;
    } else achPrev.classList.add('hidden');

    const modes = [
      { k: '1', icon: '📘', title: 'Tutorial', desc: '' },
      { k: '8', icon: '🎁', title: 'Daily Rewards', desc: '' },
      { k: '5', icon: '🏋️', title: 'Training Mode', desc: '' },
      { k: '2', icon: '🎯', title: 'Practice Range', desc: '' },
      { k: '3', icon: '🏆', title: 'Full Campaign', desc: '' },
      { k: '4', icon: '📅', title: 'Daily Challenge', desc: '' },
      { k: '6', icon: '🎴', title: 'Play Tables', desc: '' },
      { k: '7', icon: '👥', title: 'Counting Crews', desc: '' },
    ];
    document.getElementById('menu-buttons').innerHTML = modes.map(m =>
      `<button class="mode-card" data-k="${m.k}"></button>`
    ).join('');

    const contRow = document.getElementById('menu-continue-row');
    const contBtn = document.getElementById('btn-continue-session');
    if (s.sessionActive && has) {
      contRow.classList.remove('hidden');
      contBtn.className = 'lobby-continue-btn w-full py-3 rounded-xl text-sm font-semibold text-emerald-100';
      contBtn.textContent = `↩ Continue ${this.modeLabel()} — ${s.settings.practiceMode ? '∞ chips' : `🪙 ${w.chips} · 💎 ${w.gems}`}`;
    } else contRow.classList.add('hidden');
  }

  handleLobbyNav(action) {
    const map = {
      clubs: () => this.openClubs(),
      tutorial: () => this.openTutorial(),
      'daily-rewards': () => this.openDailyRewards(),
      leaderboards: () => this.openLobbyLeaderboards(),
      shop: () => this.openLobbyShop(),
    };
    map[action]?.();
  }

  handleLobbyPlay(action) {
    const map = {
      tables: () => this.openTableLobby(),
      tournament: () => this.openTournament(),
      'special-event': () => this.openSpecialEvent(),
      daily: () => this.openDaily(),
      training: () => this.openTrainingMode(),
      'dealer-mode': () => this.openDealerMode('lobby'),
      clubs: () => this.openClubs(),
    };
    map[action]?.();
  }

  handleLobbyCurrencyBuy(kind) {
    this.openLobbyShop();
    const el = document.getElementById('lobby-shop-items');
    if (!el) return;
    const target = kind === 'gems' ? 'gems' : 'chips';
    const btn = el.querySelector(`[data-shop-item*="${target}"]`) || el.querySelector('[data-shop-item]');
    if (btn) btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  openLobbyShop() {
    const el = document.getElementById('lobby-shop-items');
    if (!el) return;
    syncWalletSave(this.save);
    const claims = this.save.shopClaims || {};
    el.innerHTML = LOBBY_SHOP_ITEMS.map(item => {
      let price = '';
      if (item.free) price = claims[item.id] ? 'Claimed' : 'FREE once';
      else if (item.vip) price = `${item.costGems} 💎`;
      else if (item.costGems) price = `${item.costGems} 💎`;
      else if (item.costChips) price = `${item.costChips.toLocaleString()} 🪙`;
      const disabled = item.freeOnce && claims[item.id];
      return `<button type="button" class="w-full text-left p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 ${disabled ? 'opacity-50' : ''}"
        data-shop-item="${item.id}" ${disabled ? 'disabled' : ''}>
        <div class="font-bold text-gold">${item.name}</div>
        <div class="text-xs text-emerald-300/80">${item.desc}</div>
        <div class="text-xs font-mono text-amber-300/90 mt-1">${price}</div>
      </button>`;
    }).join('');
    showModalPremium('modal-lobby-shop');
  }

  purchaseShopItem(itemId) {
    const item = LOBBY_SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return;
    syncWalletSave(this.save);
    const claims = this.save.shopClaims || (this.save.shopClaims = {});
    if (item.freeOnce && claims[item.id]) {
      this.toast('Already claimed', 'error');
      return;
    }
    if (item.vip) {
      this.purchaseVipPassAction();
      this.openLobbyShop();
      return;
    }
    if (item.costGems && this.save.gems < item.costGems) {
      this.toast(`Need ${item.costGems} gems`, 'error');
      return;
    }
    if (item.costChips && this.save.chips < item.costChips) {
      this.toast(`Need ${item.costChips.toLocaleString()} chips`, 'error');
      return;
    }
    if (item.costGems) this.save.gems -= item.costGems;
    if (item.costChips) { this.save.chips -= item.costChips; this.save.bankroll = this.save.chips; }
    if (item.chips) addChips(this.save, item.chips);
    if (item.gems) addGems(this.save, item.gems);
    if (item.freeOnce) claims[item.id] = true;
    this.persist();
    Sounds.play('chip');
    this.toast(`Purchased ${item.name}!`, 'success', 3500);
    this.renderCurrencyDisplays();
    this.renderLobby();
    this.openLobbyShop();
  }

  openLobbyLeaderboards() {
    const el = document.getElementById('lobby-leaderboards-body');
    if (!el) return;
    const st = this.stats;
    const pb = this.save.personalBests || defaultPersonalBests();
    const wk = clubWeekKey();
    const globalBoard = getGlobalCrewLeaderboard(8);
    let globalHtml = '<p class="text-emerald-500/60 text-xs">No crews scored this week yet — play with a Counting Crew!</p>';
    if (globalBoard.length) {
      const playerClub = getPlayerClub(this.save);
      globalHtml = `<div class="felt rounded-xl p-3 border border-amber-700/30">
        <p class="text-xs uppercase text-amber-400/80 mb-2">🌍 Global Crews — ${wk}</p>
        ${globalBoard.map((c, i) => {
          const you = playerClub?.id === c.id ? ' (your crew)' : '';
          return `<div class="flex justify-between text-xs py-1 border-b border-white/5 last:border-0">
            <span>${['🥇','🥈','🥉','4.','5.','6.','7.','8.'][i]} ${c.name}${you} <span class="text-emerald-500/50">· ${c.memberCount}</span></span>
            <span class="font-mono text-amber-300">${c.crewTotal} pts</span>
          </div>`;
        }).join('')}
      </div>`;
    }
    let crewHtml = '<p class="text-emerald-500/60 text-xs">Join a Counting Crew to compete on the weekly board.</p>';
    const club = getPlayerClub(this.save);
    if (club) {
      const board = getClubWeeklyLeaderboard(club).slice(0, 5);
      crewHtml = `<div class="felt rounded-xl p-3 border border-cyan-800/25">
        <p class="text-xs uppercase text-cyan-400/80 mb-2">${club.name} — Members This Week</p>
        ${board.map((m, i) => `<div class="flex justify-between text-xs py-1 border-b border-white/5 last:border-0">
          <span>${['🥇','🥈','🥉','4.','5.'][i]} ${m.displayName}${m.id === this.save.playerId ? ' (you)' : ''}</span>
          <span class="font-mono text-amber-300">${m.weekly.points} pts</span>
        </div>`).join('')}
      </div>`;
    }
    el.innerHTML = `
      ${globalHtml}
      ${crewHtml}
      <div class="felt rounded-xl p-3 border border-emerald-800/25 space-y-1 text-xs">
        <p class="uppercase text-emerald-400/80 mb-1">Your Stats</p>
        <div class="flex justify-between"><span>Hands played</span><span class="font-mono">${st.handsPlayed}</span></div>
        <div class="flex justify-between"><span>Best bankroll</span><span class="font-mono">$${(pb.bestBankroll || 0).toLocaleString()}</span></div>
        <div class="flex justify-between"><span>Win streak</span><span class="font-mono">${pb.longestWinStreak || 0}</span></div>
        <div class="flex justify-between"><span>Count accuracy</span><span class="font-mono">${st.countGuesses ? calculateCountAccuracyPercent(st) + '%' : '—'}</span></div>
      </div>`;
    showModalPremium('modal-lobby-leaderboards');
  }

  openLobbyMinigame(id) {
    const def = LOBBY_MINIGAMES.find(m => m.id === id);
    if (!def) return;
    this._lobbyMinigameId = id;
    const ready = canPlayLobbyMinigame(this.save, def.key);
    const icon = document.getElementById('lobby-minigame-icon');
    const title = document.getElementById('lobby-minigame-title');
    const desc = document.getElementById('lobby-minigame-desc');
    const body = document.getElementById('lobby-minigame-body');
    const btn = document.getElementById('btn-lobby-minigame-action');
    if (icon) icon.textContent = def.icon;
    if (title) title.textContent = def.label;
    if (desc) desc.textContent = ready ? 'One free play per day — tap to play!' : 'You already played today. Come back tomorrow!';
    if (btn) {
      btn.textContent = ready ? 'Play Now' : 'Close';
      btn.disabled = !ready;
    }
    if (body) {
      body.innerHTML = this.renderMinigameBody(id, ready);
      if (id === 'scratch-win' && ready) {
        body.querySelector('#scratch-grid')?.addEventListener('click', (ev) => {
          const tile = ev.target.closest('[data-scratch-idx]');
          if (!tile || tile.classList.contains('revealed')) return;
          const idx = parseInt(tile.dataset.scratchIdx, 10);
          const prize = this._scratchPrizes?.[idx] ?? 0;
          tile.classList.add('revealed');
          tile.textContent = prize ? `+${prize}` : '—';
          this._scratchRevealed = (this._scratchRevealed || 0) + 1;
          if (this._scratchRevealed >= 3) {
            const total = (this._scratchPrizes || []).reduce((a, b) => a + b, 0);
            const res = document.getElementById('scratch-result');
            if (res) res.textContent = total ? `Total prize: +${total} chips!` : 'No match — try again tomorrow';
            this._scratchTotal = total;
          }
        });
      }
    }
    showModalPremium('modal-lobby-minigame');
  }

  renderMinigameBody(id, ready) {
    if (!ready) return '<p class="text-emerald-400/60 text-sm">Daily limit reached</p>';
    if (id === 'spin-win') {
      return `<p class="text-sm">Spin the wheel for chips or gems!</p>${renderSpinWheelMarkup()}`;
    }
    if (id === 'scratch-win') {
      const prizes = [25, 50, 100, 0, 25, 50, 75, 100, 150];
      this._scratchPrizes = prizes.sort(() => Math.random() - 0.5).slice(0, 3);
      this._scratchRevealed = 0;
      return `<p class="text-sm">Scratch all 3 tiles to reveal your prize!</p>
        <div class="lobby-scratch-grid" id="scratch-grid">
          ${[0, 1, 2].map(i => `<button type="button" class="lobby-scratch-tile" data-scratch-idx="${i}">?</button>`).join('')}
        </div>
        <p id="scratch-result" class="text-xs text-amber-300/90 mt-2 min-h-[1rem]"></p>`;
    }
    if (id === 'surprise-box') {
      const drills = TRAINING_DRILLS.filter(d => d.status === 'live');
      const pick = drills[Math.floor(Math.random() * drills.length)];
      return `<p class="text-sm">Today's surprise drill:</p><p class="font-bold text-gold mt-1">${pick?.name || 'Speed Drill'}</p><p class="text-xs text-emerald-400/70 mt-1">+75 bonus chips when you complete a session</p>`;
    }
    if (id === 'lucky-shot') {
      const rc = Math.floor(Math.random() * 11) - 5;
      this._luckyTarget = rc;
      return `<p class="text-sm">What is the running count?</p><p class="text-xs text-emerald-400/70 mt-1">Cards dealt: ${Math.abs(rc) + 3} · Hi-Lo tags</p>
        <input id="lucky-shot-input" type="number" class="mt-2 w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white font-mono" placeholder="Your guess" />`;
    }
    return '';
  }

  async playLobbyMinigame() {
    const id = this._lobbyMinigameId;
    const def = LOBBY_MINIGAMES.find(m => m.id === id);
    if (!def || !canPlayLobbyMinigame(this.save, def.key)) {
      document.getElementById('modal-lobby-minigame').close();
      return;
    }
    let reward = { chips: 0, gems: 0 };
    if (id === 'spin-win') {
      const btn = document.getElementById('btn-lobby-minigame-action');
      if (btn) btn.disabled = true;
      const seg = pickWeightedSegment(LOBBY_SPIN_SEGMENTS);
      const segIdx = LOBBY_SPIN_SEGMENTS.indexOf(seg);
      await spinWheelToSegment(segIdx >= 0 ? segIdx : 0);
      reward.chips = seg.chips || 0;
      reward.gems = seg.gems || 0;
      const res = document.getElementById('lobby-spin-result');
      if (res) res.textContent = seg.chips || seg.gems ? `You won: ${seg.label}!` : 'No prize this spin';
      this.toast(seg.chips || seg.gems ? `Spin: ${seg.label}!` : 'Spin: Try again tomorrow!', seg.chips || seg.gems ? 'win' : 'info', 4000);
      if (btn) btn.disabled = false;
    } else if (id === 'scratch-win') {
      if ((this._scratchRevealed || 0) < 3) {
        this.toast('Scratch all 3 tiles first', 'error');
        return;
      }
      reward.chips = this._scratchTotal ?? 0;
      this.toast(reward.chips ? `Scratch: +${reward.chips} chips!` : 'Scratch: Better luck next time', reward.chips ? 'win' : 'info');
    } else if (id === 'surprise-box') {
      reward.chips = 75;
      const live = TRAINING_DRILLS.find(d => d.status === 'live');
      if (live) this.launchTrainingDrill(live.id);
      this.toast('Surprise box! +75 chips — drill launched', 'level', 4000);
    } else if (id === 'lucky-shot') {
      const guess = parseInt(document.getElementById('lucky-shot-input')?.value, 10);
      const target = this._luckyTarget ?? 0;
      if (Number.isNaN(guess)) {
        this.toast('Enter a running count guess', 'error');
        return;
      }
      const diff = Math.abs(guess - target);
      if (diff === 0) reward.chips = 100;
      else if (diff === 1) reward.chips = 40;
      else reward.chips = 10;
      this.toast(`Lucky shot! Count was ${target >= 0 ? '+' : ''}${target} — +${reward.chips} chips`, diff === 0 ? 'win' : 'info', 4000);
    }
    if (reward.chips) addChips(this.save, reward.chips);
    if (reward.gems) addGems(this.save, reward.gems);
    markLobbyMinigamePlayed(this.save, def.key);
    this.persist();
    Sounds.play('chip');
    document.getElementById('modal-lobby-minigame').close();
    this.renderLobby();
  }

  renderTrainingDrillCard(drill) {
    const isLive = drill.status === 'live';
    const badge = isLive
      ? '<span class="text-[10px] uppercase tracking-wider text-green-400/90 bg-green-950/40 border border-green-700/30 px-1.5 py-0.5 rounded">Live</span>'
      : '<span class="text-[10px] uppercase tracking-wider text-amber-400/70 bg-amber-950/30 border border-amber-700/25 px-1.5 py-0.5 rounded">Soon</span>';
    const cardCls = isLive
      ? 'mode-card w-full text-left p-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10'
      : 'mode-card locked w-full text-left p-4 rounded-xl bg-white/5 border border-white/5 opacity-70';
    const lastSession = getTrainingHistorySessions(this.save, drill.id)[0];
    const progressBadge = lastSession
      ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/50 border border-cyan-700/30 text-cyan-300/90">Last ${lastSession.accuracy}%</span>`
      : '';
    return `<button type="button" class="${cardCls}" data-training-drill="${drill.id}" ${isLive ? '' : 'disabled'}>
      <div class="flex gap-3 items-start">
        <span class="text-2xl">${drill.icon}</span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-gold">${drill.name}</span>${badge}${progressBadge}
          </div>
          <div class="text-[10px] uppercase tracking-wider text-cyan-400/50 mt-0.5">${drill.category}</div>
          <div class="text-xs text-emerald-300/80 mt-1">${drill.desc}</div>
        </div>
      </div>
    </button>`;
  }

  renderTrainingMode() {
    const live = TRAINING_DRILLS.filter(d => d.status === 'live').length;
    const histCount = getTrainingHistorySessions(this.save).length;
    document.getElementById('training-mode-subtitle').textContent = histCount
      ? `${live} drill${live === 1 ? '' : 's'} ready · ${histCount} session${histCount === 1 ? '' : 's'} logged`
      : `${live} drill${live === 1 ? '' : 's'} ready — all live`;
    document.getElementById('training-drill-list').innerHTML = TRAINING_DRILLS.map(d => this.renderTrainingDrillCard(d)).join('');
    this.renderDailyTrainingPanel('training');
  }

  renderTrainingHistoryMetaLine(session) {
    const m = session.meta || {};
    if (session.drillId === 'combined' && m.strategyAccuracy != null) {
      return `Count ${m.countAccuracy ?? session.accuracy}% · Strategy ${m.strategyAccuracy}%`;
    }
    if (session.drillId === 'count-speed' && m.cardCount) {
      return `${m.cardCount} cards · ${m.speed || 'normal'} pace`;
    }
    if (session.drillId === 'true-count' && m.difficulty) {
      return `${TC_DRILL_DIFFICULTIES[m.difficulty]?.label || m.difficulty} · ${m.roundSize || session.attempts} problems`;
    }
    if (session.drillId === 'count-shoe' && m.cardsDealt) {
      return `${m.cardsDealt} cards dealt`;
    }
    if (session.drillId === 'decisions' || session.drillId === 'betting') {
      return `${m.correct ?? '?'}/${m.total ?? session.attempts} correct`;
    }
    if (session.drillId === 'index-plays' && m.mode) {
      return `${INDEX_PLAY_MODES[m.mode]?.label || m.mode} · ${m.roundSize || session.attempts} problems`;
    }
    if (session.drillId === 'bet-spread' && m.preset) {
      const ramp = m.rampScore != null ? ` · ramp ${m.rampScore}%` : '';
      return `${BET_SPREAD_PRESETS[m.preset]?.label || m.preset} · ${BET_SPREAD_SCENARIOS[m.scenario]?.label || ''}${ramp}`;
    }
    return `${session.attempts} attempt${session.attempts === 1 ? '' : 's'}`;
  }

  renderTrainingHistory() {
    const filter = this.trainingHistoryFilter || 'all';
    const all = getTrainingHistorySessions(this.save);
    const sessions = getTrainingHistorySessions(this.save, filter);
    const trend = summarizeTrainingHistoryTrend(sessions);

    const drillIds = [...new Set(all.map(s => s.drillId))];
    const filtersEl = document.getElementById('training-history-filters');
    if (filtersEl) {
      const pill = (id, label, active) =>
        `<button type="button" data-history-filter="${id}" class="px-3 py-1.5 rounded-full text-xs font-medium border transition ${active
          ? 'bg-cyan-800/50 border-cyan-500/50 text-cyan-100'
          : 'bg-black/20 border-white/10 text-emerald-300/70 hover:bg-white/10'}">${label}</button>`;
      filtersEl.innerHTML = [
        pill('all', `All (${all.length})`, filter === 'all'),
        ...drillIds.map(id => pill(id, trainingHistoryDrillLabel(id).replace(/^.\s/, ''), filter === id)),
      ].join('');
    }

    const trendEl = document.getElementById('training-history-trend');
    if (trendEl) {
      if (!trend.count) {
        trendEl.innerHTML = '<p class="text-emerald-400/70 text-center">Complete any training drill to start building your history.</p>';
      } else {
        const filterLabel = filter === 'all' ? 'All drills' : trainingHistoryDrillLabel(filter);
        let trendLine = `<strong class="text-gold">${filterLabel}</strong> — ${trend.count} session${trend.count === 1 ? '' : 's'} logged`;
        if (trend.recentAvg !== null) {
          trendLine += `<br>Recent avg accuracy: <strong>${trend.recentAvg}%</strong>`;
          if (trend.avgErrorRecent != null) trendLine += ` · avg error <strong>${trend.avgErrorRecent}</strong>`;
        }
        if (trend.earlierAvg !== null && trend.delta !== null) {
          const arrow = trend.improving ? '↑' : trend.delta < 0 ? '↓' : '→';
          const deltaColor = trend.improving ? 'text-green-400' : trend.delta < 0 ? 'text-amber-300' : 'text-emerald-300';
          trendLine += `<br><span class="${deltaColor}">${arrow} vs earlier sessions: ${trend.earlierAvg}% → ${trend.recentAvg}% (${trend.delta >= 0 ? '+' : ''}${trend.delta}%)</span>`;
        }
        trendEl.innerHTML = trendLine;
      }
    }

    const listEl = document.getElementById('training-history-list');
    const emptyEl = document.getElementById('training-history-empty');
    if (!sessions.length) {
      if (listEl) listEl.innerHTML = '';
      emptyEl?.classList.remove('hidden');
      if (filter !== 'all') {
        emptyEl.textContent = `No sessions for this drill yet — try ${trainingHistoryDrillLabel(filter)}.`;
      } else {
        emptyEl.textContent = 'No sessions yet — complete a drill to start tracking progress.';
      }
      return;
    }
    emptyEl?.classList.add('hidden');
    if (listEl) {
      listEl.innerHTML = sessions.slice(0, 50).map(s => {
        const accColor = s.accuracy >= 80 ? 'text-green-400' : s.accuracy >= 60 ? 'text-amber-300' : 'text-red-300';
        return `<div class="rounded-xl bg-black/25 border border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="font-semibold text-sm text-gold">${trainingHistoryDrillLabel(s.drillId)}</div>
            <div class="text-[11px] text-emerald-400/60">${formatTrainingHistoryWhen(s.ts)}</div>
            <div class="text-xs text-emerald-300/70 mt-0.5">${this.renderTrainingHistoryMetaLine(s)}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-lg font-bold ${accColor}">${s.accuracy}%</div>
            <div class="text-[10px] text-emerald-500/60">avg err ${s.avgError}</div>
          </div>
        </div>`;
      }).join('');
    }

    const sub = document.getElementById('training-history-subtitle');
    if (sub) {
      sub.textContent = filter === 'all'
        ? `${all.length} total session${all.length === 1 ? '' : 's'} across all drills`
        : `${sessions.length} session${sessions.length === 1 ? '' : 's'} for this drill`;
    }
  }

  renderMistakeReview() {
    const filter = this.mistakeReviewFilter || 'all';
    const all = getMistakeReviewEntries(this.save);
    const entries = getMistakeReviewEntries(this.save, filter);
    const summary = summarizeMistakeReview(entries);

    const drillIds = [...new Set(all.map(e => e.drillId))];
    const filtersEl = document.getElementById('training-mistakes-filters');
    if (filtersEl) {
      const pill = (id, label, active) =>
        `<button type="button" data-mistake-filter="${id}" class="px-3 py-1.5 rounded-full text-xs font-medium border transition ${active
          ? 'bg-red-800/50 border-red-500/50 text-red-100'
          : 'bg-black/20 border-white/10 text-emerald-300/70 hover:bg-white/10'}">${label}</button>`;
      filtersEl.innerHTML = [
        pill('all', `All (${all.length})`, filter === 'all'),
        ...drillIds.map(id => pill(id, trainingHistoryDrillLabel(id).replace(/^.\s/, ''), filter === id)),
      ].join('');
    }

    const summaryEl = document.getElementById('training-mistakes-summary');
    if (summaryEl) {
      if (!summary.count) {
        summaryEl.innerHTML = '<p class="text-emerald-400/70 text-center">Mistakes from training drills appear here so you can review and improve.</p>';
      } else {
        const filterLabel = filter === 'all' ? 'All drills' : trainingHistoryDrillLabel(filter);
        let line = `<strong class="text-gold">${filterLabel}</strong> — ${summary.count} mistake${summary.count === 1 ? '' : 's'} logged`;
        if (summary.recent) line += `<br><span class="text-amber-300/90">${summary.recent} in the last 7 days</span>`;
        if (summary.topDrill && filter === 'all') {
          line += `<br>Most common: <strong>${trainingHistoryDrillLabel(summary.topDrill)}</strong> (${summary.topDrillCount})`;
        }
        const cats = Object.entries(summary.byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([c, n]) => `${mistakeReviewCategoryLabel(c)} (${n})`)
          .join(' · ');
        if (cats) line += `<br><span class="text-emerald-400/70 text-xs">${cats}</span>`;
        summaryEl.innerHTML = line;
      }
    }

    const listEl = document.getElementById('training-mistakes-list');
    const emptyEl = document.getElementById('training-mistakes-empty');
    if (!entries.length) {
      if (listEl) listEl.innerHTML = '';
      emptyEl?.classList.remove('hidden');
      if (filter !== 'all') {
        emptyEl.textContent = `No mistakes logged for this drill yet — ${trainingHistoryDrillLabel(filter)} looks clean!`;
      } else {
        emptyEl.textContent = 'No mistakes logged yet — great work, or complete a drill to start learning from errors.';
      }
      return;
    }
    emptyEl?.classList.add('hidden');
    if (listEl) {
      listEl.innerHTML = entries.slice(0, 50).map(e => `
        <div class="rounded-xl bg-black/25 border border-red-900/25 px-4 py-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="font-semibold text-sm text-gold">${trainingHistoryDrillLabel(e.drillId)}</div>
              <div class="text-[10px] text-red-300/70 uppercase tracking-wide">${mistakeReviewCategoryLabel(e.category)}</div>
            </div>
            <div class="text-[11px] text-emerald-400/60 shrink-0">${formatTrainingHistoryWhen(e.ts)}</div>
          </div>
          ${e.context ? `<div class="text-xs text-emerald-300/80 mt-1">${e.context}</div>` : ''}
          <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-lg bg-red-950/35 px-2.5 py-2 border border-red-800/30">
              <div class="text-red-400/70 text-[10px] uppercase tracking-wide">You</div>
              <div class="font-medium text-red-200 mt-0.5">${e.wrong}</div>
            </div>
            <div class="rounded-lg bg-green-950/35 px-2.5 py-2 border border-green-800/30">
              <div class="text-green-400/70 text-[10px] uppercase tracking-wide">Correct</div>
              <div class="font-medium text-green-200 mt-0.5">${e.correct}</div>
            </div>
          </div>
          ${e.detail ? `<div class="text-[11px] text-emerald-400/65 mt-1.5">${e.detail}</div>` : ''}
        </div>`).join('');
    }

    const sub = document.getElementById('training-mistakes-subtitle');
    if (sub) {
      sub.textContent = filter === 'all'
        ? `${all.length} total mistake${all.length === 1 ? '' : 's'} across all drills`
        : `${entries.length} mistake${entries.length === 1 ? '' : 's'} for this drill`;
    }
  }

  renderPracticeRange() {
    document.getElementById('practice-range-drills').innerHTML = PRACTICE_DRILLS.map(d =>
      `<button class="mode-card w-full text-left p-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10" data-drill="${d.id}">
        <div class="flex gap-3 items-start">
          <span class="text-2xl">${d.icon}</span>
          <div><div class="font-bold text-gold">${d.name}</div><div class="text-xs text-emerald-300/80 mt-1">${d.desc}</div></div>
        </div>
      </button>`
    ).join('');
  }

  renderSpeedDrillStatsPanel() {
    const el = document.getElementById('speed-drill-stats');
    if (!el) return;
    const visit = summarizeSpeedDrillRounds(this.speedDrillVisit || []);
    const lifetime = summarizeSpeedDrillHistory(this.save.speedDrill?.sessions || []);
    const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
    const sessionBlock = visit.total
      ? `<div class="mb-3 pb-3 border-b border-white/10">
          <p class="text-xs uppercase tracking-wider text-cyan-400/80 mb-2 text-center">This session</p>
          <div class="grid grid-cols-2 gap-2 text-center text-xs">
            <div class="rounded-lg bg-cyan-950/30 p-2 border border-cyan-800/25">
              <div class="text-emerald-400/70">Accuracy (±1)</div>
              <div class="font-bold text-lg text-cyan-200">${visit.accuracy}%</div>
            </div>
            <div class="rounded-lg bg-cyan-950/30 p-2 border border-cyan-800/25">
              <div class="text-emerald-400/70">Avg error</div>
              <div class="font-bold text-lg text-cyan-200">${visit.avgError}</div>
            </div>
          </div>
          <p class="text-[10px] text-emerald-500/50 text-center mt-1">${visit.total} round${visit.total === 1 ? '' : 's'} this visit</p>
        </div>`
      : '';
    const lifetimeBlock = lifetime.total
      ? `<p class="text-xs uppercase tracking-wider text-amber-400/80 mb-2 text-center">All time</p>
         <div class="grid grid-cols-2 gap-2 text-center text-xs">
           <div class="rounded-lg bg-black/30 p-2"><div class="text-emerald-400/70">Accuracy (±1)</div><div class="font-bold text-lg text-emerald-200">${lifetime.accuracy}%</div></div>
           <div class="rounded-lg bg-black/30 p-2"><div class="text-emerald-400/70">Avg error</div><div class="font-bold text-lg text-emerald-200">${lifetime.avgError}</div></div>
         </div>
         <p class="text-[10px] text-emerald-500/50 text-center mt-2">${lifetime.total} round${lifetime.total === 1 ? '' : 's'} saved</p>`
      : '<p class="text-emerald-400/60 text-center text-xs">Complete a round to see session stats.</p>';
    el.innerHTML = sessionBlock + lifetimeBlock;
  }

  renderSpeedDrill() {
    const ds = this.drillState || { subPhase: 'setup' };
    const prefs = this.save.speedDrill?.prefs || defaultSpeedDrillPrefs();
    const setup = document.getElementById('speed-drill-setup');
    const active = document.getElementById('speed-drill-active');
    const quiz = document.getElementById('speed-drill-quiz');
    const result = document.getElementById('speed-drill-result');
    const sub = ds.subPhase || 'setup';

    setup.classList.toggle('hidden', sub !== 'setup');
    active.classList.toggle('hidden', sub !== 'dealing');
    quiz.classList.toggle('hidden', sub !== 'quiz');
    result.classList.toggle('hidden', sub !== 'result');

    if (sub === 'setup' || sub === 'result') {
      const cardsSel = document.getElementById('speed-drill-cards');
      const speedSel = document.getElementById('speed-drill-speed');
      const showChk = document.getElementById('speed-drill-show-count');
      if (cardsSel) cardsSel.value = String(prefs.cardCount);
      if (speedSel) speedSel.value = prefs.speed;
      if (showChk) showChk.checked = prefs.showCount;
    }

    if (sub === 'dealing') {
      document.getElementById('speed-drill-progress').textContent =
        `Card ${ds.cardsDealt} of ${ds.cardTarget}${ds.paused ? ' · PAUSED' : ''}`;
      const area = document.getElementById('speed-drill-card-area');
      const tagLabel = ds.lastTag > 0 ? `+${ds.lastTag}` : `${ds.lastTag}`;
      const tagColor = ds.lastTag > 0 ? 'text-green-400' : ds.lastTag < 0 ? 'text-red-400' : 'text-slate-300';
      area.innerHTML = ds.lastCard
        ? `<div class="scale-125">${this.renderCard(ds.lastCard)}</div>
           <p class="text-sm ${tagColor} font-mono">Hi-Lo tag: ${tagLabel}</p>
           <p class="text-xs text-emerald-400/50">Keep the running total in your head…</p>`
        : '<p class="text-emerald-300/60">Starting…</p>';
      const hud = document.getElementById('speed-drill-live-hud');
      if (ds.showCount && this.counter) {
        const rc = this.counter.runningCount;
        const fmt = rc >= 0 ? `+${rc}` : `${rc}`;
        hud.classList.remove('hidden');
        hud.textContent = `Running count (shown): ${fmt}`;
      } else {
        hud.classList.add('hidden');
      }
      const pauseBtn = document.getElementById('btn-speed-drill-pause');
      if (pauseBtn) pauseBtn.textContent = ds.paused ? 'Resume' : 'Pause';
    }

    if (sub === 'quiz') {
      const input = document.getElementById('speed-drill-guess');
      if (input) input.value = '';
    }

    if (sub === 'result' && ds.lastResult) {
      const visit = summarizeSpeedDrillRounds(this.speedDrillVisit || []);
      const sessionLine = visit.total
        ? `<p class="text-xs text-cyan-300/80 font-mono">Session: ${visit.accuracy}% accurate (±1) · avg error ${visit.avgError} · ${visit.total} round${visit.total === 1 ? '' : 's'}</p>`
        : '';
      result.innerHTML = `
        ${this.formatSpeedDrillResultMessage(ds.lastResult)}
        <p class="text-emerald-300/70">You counted ${ds.cardTarget} cards at ${ds.speed} speed.</p>
        ${sessionLine}
        <div class="flex gap-2 justify-center pt-2 flex-wrap">
          <button type="button" id="btn-speed-drill-again" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-stone-900 font-bold">Try Again</button>
          ${visit.total ? '<button type="button" id="btn-speed-drill-end-session" class="px-6 py-2.5 rounded-xl bg-cyan-950/60 border border-cyan-600/40 text-cyan-100 font-semibold">End Session</button>' : ''}
          <button type="button" id="btn-speed-drill-new-settings" class="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15">Change Settings</button>
        </div>`;
      document.getElementById('btn-speed-drill-again')?.addEventListener('click', () => this.startSpeedDrillRound());
      document.getElementById('btn-speed-drill-end-session')?.addEventListener('click', () => {
        const v = summarizeSpeedDrillRounds(this.speedDrillVisit || []);
        if (!v.total) return;
        this.finishDrillWithSummary('count-speed', {
          rounds: this.speedDrillVisit,
          subtitle: `${v.total} round${v.total === 1 ? '' : 's'} · ${ds.cardTarget || 20} cards · ${ds.speed || 'normal'} pace`,
        });
      });
      document.getElementById('btn-speed-drill-new-settings')?.addEventListener('click', () => {
        this.drillState = { subPhase: 'setup' };
        this.renderSpeedDrill();
      });
    }

    this.renderSpeedDrillStatsPanel();
  }

  renderDrillCount(lastCard = null) {
    const ds = this.drillState || { cardsDealt: 0 };
    document.getElementById('drill-count-status').textContent =
      `${ds.cardsDealt} cards dealt · ${this.shoe?.cardsRemaining || 0} remaining`;
    const box = document.getElementById('drill-count-cards');
    if (lastCard) {
      const prev = box.innerHTML;
      box.innerHTML = prev + this.renderCard(lastCard);
    } else box.innerHTML = '';
    const hud = document.getElementById('drill-count-hud');
    hud.innerHTML = this.help.showCountAtTable() && this.shoe
      ? this.renderCountBoxes(true, this.shoe) : '';
  }

  updateSeatBetIndicator(amount) {
    const el = document.getElementById('bet-placed-amount');
    if (el) el.textContent = amount;
    const ind = document.getElementById('casino-seat-bet-indicator');
    if (ind && (this.phase === 'bet' || this.phase === 'countConfirm')) {
      ind.classList.remove('hidden');
      ind.setAttribute('aria-hidden', 'false');
    }
  }

  renderCasinoSeats() {
    const human = document.getElementById('casino-seat-human');
    if (!human) return;
    const st = this.playerHands.length ? this.activeState() : null;
    const active = this.phase === 'playing' && st && !st.finished;
    human.classList.toggle('active-hand', !!active);
    const statusEl = human.querySelector('.casino-seat-status');
    if (statusEl) {
      const totalBet = (this.playerHands || []).reduce((s, h) => s + (h.bet || 0), 0);
      let status = totalBet ? `$${totalBet}` : 'Ready';
      let statusCls = '';
      if (this.phase === 'handEnd' && this.results?.length) {
        const wins = this.results.filter(r => r.r === 'win' || r.r === 'blackjack').length;
        const losses = this.results.filter(r => r.r === 'loss' || r.r === 'surrender').length;
        if (wins && !losses) { status = 'Won'; statusCls = 'casino-seat-ai-result-win'; }
        else if (losses && !wins) { status = 'Lost'; statusCls = 'casino-seat-ai-result-loss'; }
        else if (wins === losses) { status = 'Push'; statusCls = 'casino-seat-ai-result-push'; }
        else { status = `${wins}W`; statusCls = 'casino-seat-ai-result-win'; }
      } else if (this.phase === 'bet' || this.phase === 'countConfirm') {
        status = 'Seat 4';
      }
      statusEl.textContent = status;
      statusEl.className = statusCls ? `casino-seat-status ${statusCls}` : 'casino-seat-status';
    }
    for (const seatNum of TABLE_AI_SEAT_NUMS) {
      const el = document.getElementById(`casino-seat-${seatNum}`);
      if (!el) continue;
      const ai = this.tableAiSeats?.[seatNum];
      if (ai) {
        el.className = 'casino-seat casino-seat-ai';
        el.innerHTML = this.renderTableAiSeatHtml(ai);
      } else {
        el.className = 'casino-seat casino-seat-empty casino-seat-ai-ready';
        el.innerHTML = this.renderEmptyCasinoSeatHtml(seatNum);
      }
    }
  }

  /** Sync header/action-bar CSS vars and scale table to fit viewport (no scrollbars). */
  syncCasinoShellMetrics() {
    const header = document.getElementById('app-header');
    const actionBar = document.getElementById('action-bar');
    if (header && !header.classList.contains('hidden')) {
      document.documentElement.style.setProperty('--cq-header-h', `${header.offsetHeight}px`);
    }
    const actionVisible = actionBar && !actionBar.classList.contains('hidden');
    const actionReserve = actionVisible ? actionBar.offsetHeight : 8;
    document.documentElement.style.setProperty('--cq-action-bar-h', `${actionReserve}px`);
    this.fitCasinoPlayViewport();
  }

  fitCasinoPlayViewport() {
    const viewport = document.querySelector('.casino-table-viewport');
    const shell = document.getElementById('screen-casino-play');
    if (!viewport || !shell || shell.classList.contains('hidden')) return;
    viewport.style.transform = '';
    viewport.style.width = '';
    viewport.style.maxWidth = '';
    viewport.style.marginBottom = '';
    const shellH = shell.clientHeight;
    const shellW = shell.clientWidth;
    if (shellH < 1 || shellW < 1) return;
    const handend = document.getElementById('screen-handend');
    const handendReserve = (
      this.phase === 'handEnd'
      && handend
      && !handend.classList.contains('hidden')
    ) ? handend.offsetHeight + 8 : 0;
    const topbar = viewport.querySelector('.casino-table-topbar');
    const grid = document.getElementById('casino-seat-grid');
    const contentH = Math.max(viewport.scrollHeight, viewport.offsetHeight);
    const contentW = Math.max(
      viewport.scrollWidth,
      viewport.offsetWidth,
      topbar?.scrollWidth || 0,
      grid?.scrollWidth || 0,
    );
    const maxH = Math.max(1, shellH - handendReserve);
    const scaleY = contentH > maxH ? maxH / contentH : 1;
    const scaleX = contentW > shellW ? shellW / contentW : 1;
    const scale = Math.min(1, scaleX, scaleY);
    const applied = Math.max(0.62, scale);
    if (applied < 0.995) {
      const inv = 100 / applied;
      viewport.style.width = `${inv}%`;
      viewport.style.maxWidth = `${inv}%`;
      viewport.style.transform = `scale(${applied})`;
      viewport.style.marginBottom = `-${contentH * (1 - applied)}px`;
    }
  }

  applyPlayerHandsFitScale(ph, maxCards, splitN) {
    if (!ph) return;
    let scale = 1;
    if (splitN >= 4) scale = Math.min(scale, 0.78);
    else if (splitN >= 3) scale = Math.min(scale, 0.86);
    else if (splitN >= 2) scale = Math.min(scale, 0.92);
    if (maxCards >= 11) scale = Math.min(scale, 0.62);
    else if (maxCards >= 10) scale = Math.min(scale, 0.68);
    else if (maxCards >= 9) scale = Math.min(scale, 0.74);
    else if (maxCards >= 7) scale = Math.min(scale, 0.82);
    else if (maxCards >= 5) scale = Math.min(scale, 0.9);
    ph.style.setProperty('--cq-hand-scale', String(scale));
  }

  renderHandEndCountStrip(shoe) {
    if (!this.wantsCountDisplay() || !shoe) {
      return '<span class="handend-stat">🔒 Count hidden</span>';
    }
    const i = this.counter.getCountSnapshot(shoe);
    const sys = COUNTING_SYSTEMS[i.systemId] || COUNTING_SYSTEMS['hi-lo'];
    const rs = i.runningCount >= 0 ? `+${i.runningCount}` : `${i.runningCount}`;
    const stat = (label, val) => `<span class="handend-stat">${label} <b>${val}</b></span>`;
    if (sys.balanced) {
      const ts = i.trueCount >= 0 ? `+${i.trueCount.toFixed(1)}` : i.trueCount.toFixed(1);
      return stat('RC', rs) + stat('TC', ts) + stat('Decks', i.decksRemaining.toFixed(1)) + stat('Seen', i.cardsCounted);
    }
    const vs = i.abovePivot >= 0 ? `+${i.abovePivot}` : `${i.abovePivot}`;
    return stat('RC', rs) + stat('Key', `+${i.pivot}`) + stat('Above', vs) + stat('Seen', i.cardsCounted);
  }

  renderBet() {
    const isBetDrill = this.save.sessionDrill === 'betting';
    const showCount = this.help.showCountInPlay();
    const hud = document.getElementById('count-hud-bet');
    hud.innerHTML = this.shoe ? this.renderCountBoxes(showCount, this.shoe) : '';
    hud.classList.toggle('hidden', !showCount && this.help.level > 1 && !isBetDrill);
    const adv = document.getElementById('bet-advice');
    const rec = this.betSuggestion?.amount;
    if (isBetDrill) {
      adv.classList.remove('hidden');
      adv.innerHTML = `🎯 Bet drill round ${this.drillState?.round || 1}/8 — pick the count-based bet (exact amount)`;
    } else if (this.help.showBetSuggestion() && this.betSuggestion) {
      adv.classList.remove('hidden');
      const why = recommendedBetWhyText(this.betSuggestion);
      const recLine = this.help.showExactBet()
        ? `<div class="flex flex-wrap items-center justify-center gap-1 min-w-0 max-w-full"><strong class="truncate max-w-full">Recommended: $${rec}</strong>${infoTipButton(why, 'Why this bet amount?')}</div>`
        : `<span class="block truncate max-w-full">${this.help.formatBetRange(this.betSuggestion, this.bankroll, this.minBet)}</span>`;
      adv.innerHTML = `<div class="w-full min-w-0 max-w-full mx-auto"><div class="min-w-0">${recLine}</div><p class="text-xs text-emerald-400/70 truncate min-w-0">${why}</p></div>`;
    } else { adv.classList.add('hidden'); }
    const dealBtn = document.getElementById('btn-deal');
    if (dealBtn) dealBtn.textContent = isBetDrill ? 'Submit Bet' : 'Deal Cards';
    const baseRec = rec || this.minBet;
    const maxChip = Math.min(this.bankroll, Math.floor(this.bankroll * 0.1));
    const rawChips = [this.minBet, baseRec, Math.min(this.bankroll, baseRec * 2), maxChip];
    const chips = rawChips.filter((v, i, a) => v >= this.minBet && a.indexOf(v) === i);
    const regularChips = chips.filter(c => !(c === maxChip && c > baseRec * 3 && c >= 200));
    const highRollerChips = chips.filter(c => c === maxChip && c > baseRec * 3 && c >= 200 && !regularChips.includes(c));
    const renderChip = (c, opts = {}) => {
      const isRec = c === rec;
      const isHighRoller = opts.highRoller;
      let colors = isRec
        ? 'recommended bg-gradient-to-br from-amber-400 to-amber-600 text-stone-900'
        : c === this.minBet ? 'bg-emerald-700 text-white' : 'bg-red-800 text-white';
      if (isHighRoller) colors += ' high-roller';
      const badges = isRec
        ? '<span class="absolute -top-2 -right-1 text-[9px] bg-gold text-stone-900 px-1 rounded">REC</span>'
        : isHighRoller ? '<span class="high-roller-tag">High Roller</span>' : '';
      return `<button class="bet-chip px-5 py-2 ${colors} relative" data-bet="${c}"${isHighRoller ? ' title="Large bet — for experienced players"' : ''}>
        $${c}${badges}
      </button>`;
    };
    document.getElementById('chip-buttons').innerHTML =
      regularChips.map(c => renderChip(c)).join('')
      + (highRollerChips.length ? `<div class="w-full flex justify-center gap-3 mt-2 pt-2 border-t border-white/5">${highRollerChips.map(c => renderChip(c, { highRoller: true })).join('')}</div>` : '');
    const betInput = document.getElementById('bet-input');
    betInput.min = this.minBet;
    betInput.max = this.practice ? 1_000_000 : Math.max(this.minBet, this.bankroll);
    betInput.step = 1;
    betInput.value = rec || this.minBet;
    const seatAmt = document.getElementById('bet-placed-amount');
    if (seatAmt) seatAmt.textContent = betInput.value;
    const seatInd = document.getElementById('casino-seat-bet-indicator');
    if (seatInd) {
      seatInd.classList.remove('hidden');
      seatInd.setAttribute('aria-hidden', 'false');
    }
    document.getElementById('action-buttons').innerHTML = '';
    const ph = document.getElementById('player-hands');
    if (ph) {
      ph.innerHTML = '';
      ph.classList.remove('casino-seat-cards-split', 'casino-seat-cards-split-3', 'casino-seat-cards-split-4');
    }
  }

  renderTable() {
    const showCount = this.help.showCountAtTable();
    const hud = document.getElementById('count-hud');
    hud.innerHTML = this.shoe ? this.renderCountBoxes(showCount, this.shoe) : '';
    const shoeEl = document.getElementById('shoe-status');
    if (shoeEl && this.shoe) {
      const shoeHint = this.maybeExplainShoeTerm();
      shoeEl.innerHTML = `Remaining cards in deck: ${this.shoe.beginnerSummary()}${shoeHint ? `<br>${shoeHint}` : ''}`;
    } else if (shoeEl) shoeEl.textContent = '';

    const animBase = Math.max(0, this.dealAnimIndex - 1);
    const showDealAnim = this.dealing;
    const dealerEl = document.getElementById('dealer-cards');
    const dealerCardN = this.dealer.cards.length;
    dealerEl.classList.toggle('dealer-cards-wide', dealerCardN >= 5);
    dealerEl.classList.toggle('dealer-cards-many', dealerCardN >= 7);
    dealerEl.innerHTML = this.dealer.cards.map((c, i) => {
      const isLast = showDealAnim && i === this.dealer.cards.length - 1;
      const anim = isLast ? animBase : null;
      return this.renderCard(c, this.hideHole && i === 1, anim);
    }).join('');
    document.getElementById('dealer-total').innerHTML = this.handTotalHtml(this.dealer, this.hideHole);

    const st = this.playerHands.length ? this.activeState() : null;
    const up = this.dealer.cards[0]?.rank;
    const stratOpts = this.buildStratOpts();
    const indexContext = st && up
      ? getLiveIndexContext(st.hand, up, stratOpts.trueCount, stratOpts.countingSystemId, stratOpts.useIndexDeviations)
      : null;
    let hint = document.getElementById('strategy-hint');
    if (st && up) {
      const a = advise(st.hand, up, this.canDouble(st), this.canSplit(st), stratOpts);
      const showHint = this.help.shouldShowHint(a, st.hand.value(), null, {
        hasIndexPlay: !!indexContext?.hasIndexPlay,
        deviationsEnabled: stratOpts.useIndexDeviations,
      });
      if (showHint) {
        hint.textContent = formatStrategyHintText(a);
        hint.classList.remove('hidden');
      } else if (!this.help.showStrategyOnMistake()) hint.classList.add('hidden');
    } else if (!this.help.showStrategyOnMistake()) hint.classList.add('hidden');

    const ph = document.getElementById('player-hands');
    const splitN = this.playerHands.length;
    const maxCards = splitN ? Math.max(...this.playerHands.map(h => h.hand.cards.length)) : 0;
    ph.classList.toggle('casino-seat-cards-split', splitN > 1);
    ph.classList.toggle('casino-seat-cards-split-3', splitN >= 3);
    ph.classList.toggle('casino-seat-cards-split-4', splitN >= 4);
    ph.classList.toggle('casino-seat-cards-wide', maxCards >= 5);
    this.applyPlayerHandsFitScale(ph, maxCards, splitN);
    ph.innerHTML = this.playerHands.map((h, i) => {
      const active = i === this.activeIdx && !h.finished;
      const cardN = h.hand.cards.length;
      const cardsCls = cardN >= 10 ? 'casino-hand-cards-cards-9 casino-hand-cards-cards-10'
        : cardN >= 9 ? 'casino-hand-cards-cards-9'
        : cardN >= 8 ? 'casino-hand-cards-cards-8'
        : cardN >= 7 ? 'casino-hand-cards-cards-7'
        : cardN >= 6 ? 'casino-hand-cards-cards-6'
        : cardN >= 5 ? 'casino-hand-cards-cards-5' : '';
      const suffix = h.doubled ? ' ×2' : '';
      return `<div class="casino-player-hand ${active ? 'ring-1 ring-amber-400/60 rounded-lg p-0.5' : ''}">
        ${this.playerHands.length > 1 ? `<span class="casino-seat-ai-total">H${i + 1}${active ? ' ◀' : ''}</span>` : ''}
        <div class="casino-hand-cards ${cardsCls}">${h.hand.cards.map((c, ci) => {
          const isLast = showDealAnim && ci === h.hand.cards.length - 1;
          return this.renderCard(c, false, isLast ? animBase : null);
        }).join('')}</div>
        <span class="casino-seat-ai-total">${this.handTotalHtml(h.hand)}${suffix}</span>
      </div>`;
    }).join('');

    document.getElementById('casino-seat-bet-indicator')?.classList.add('hidden');
    const ab = document.getElementById('action-buttons');
    if (st && !st.finished && !st.splitAces) {
      const cd = this.canDouble(st), cs = this.canSplit(st), sur = this.canSurrender(st);
      const isDecDrill = this.save.sessionDrill === 'decisions';
      ab.innerHTML = [
        ['hit','Hit','bg-gradient-to-b from-green-500 to-green-700 shadow-lg'],['stand','Stand','bg-gradient-to-b from-red-600 to-red-900 shadow-lg'],
        cd && !isDecDrill ? ['double','Double','bg-gradient-to-b from-amber-400 to-amber-600 text-stone-900 shadow-lg'] : null,
        cs && !isDecDrill ? ['split','Split','bg-gradient-to-b from-blue-500 to-blue-800 shadow-lg'] : null,
        sur && !isDecDrill ? ['surrender','Surrender','bg-gradient-to-b from-slate-500 to-slate-800 shadow-lg'] : null,
      ].filter(Boolean).map(([a,l,c]) =>
        `<button class="action-btn px-8 rounded-2xl ${c} font-bold hover:brightness-110 active:scale-95 transition" data-action="${a}">${l}</button>`
      ).join('');
    } else ab.innerHTML = '';
  }

  renderHandEnd() {
    const summaryEl = document.getElementById('handend-summary');
    const parts = (this.results || []).map(r => {
      const icon = r.r === 'blackjack' ? '★' : r.r === 'win' ? '✓' : r.r === 'push' ? '═' : '✗';
      return `${icon} ${r.label} ${r.r.toUpperCase()} (${r.net >= 0 ? '+' : ''}$${r.net})`;
    });
    summaryEl.textContent = parts.length ? parts.join(' · ') : 'Hand complete';

    const fb = document.getElementById('handend-feedback');
    const lvl = this.help.level;
    const mp = this.help.modeProfile;
    let msg = '';
    if (this.stats.helpLevelups > 0 && this.stats.lastLevelUpHand === this.stats.handsPlayed) {
      msg = `★ Level ${lvl} (${HELP_LABELS[lvl]})! `;
    }
    const hint = this.help.modeHint();
    if (hint) msg += hint;
    else if (lvl === 0) msg += 'Review count & bet below.';
    else if (lvl === 1) msg += 'Did your bet match the count range?';
    else if (lvl <= 3) msg += 'Track the running count.';
    if (mp === 'drill-combined') msg = this.combinedSessionSummaryText();
    if (mp === 'campaign') msg = `${THEMES[this.settings.theme]?.name || 'Campaign'} · ${msg}`.trim();
    if (mp === 'daily' && this.dailyChallenge) msg = `${this.dailyChallenge.title} · ${msg}`.trim();
    if (this.sessionMode === 'tournament' && this.save.tournament?.match) {
      const m = this.save.tournament.match;
      msg = `🏆 vs ${m.opponentName} H${m.handsPlayed}/${TOURNAMENT_HANDS_PER_MATCH} · P/L ${this.session.netPL >= 0 ? '+' : ''}$${this.session.netPL}`;
      const nextBtn = document.getElementById('btn-next-hand');
      if (nextBtn) nextBtn.textContent = m.handsPlayed >= TOURNAMENT_HANDS_PER_MATCH ? 'Resolve' : 'Next';
    } else if (this.session && mp !== 'drill-combined') {
      msg = `${msg ? msg + ' · ' : ''}Session ${this.session.netPL >= 0 ? '+' : ''}$${this.session.netPL}`.trim();
      const nextBtn = document.getElementById('btn-next-hand');
      if (nextBtn) nextBtn.textContent = 'Next Hand';
    }
    fb.textContent = msg.replace(/\s+/g, ' ').trim();

    const showC = this.help.showEndOfHandCount();
    const countEl = document.getElementById('handend-count');
    countEl.classList.toggle('hidden', !showC);
    if (showC && this.shoe) countEl.innerHTML = this.renderHandEndCountStrip(this.shoe);

    const rev = document.getElementById('handend-review');
    const showReview = this.help.postHandReview() && this.roundReview;
    if (showReview) {
      rev.classList.remove('hidden');
      if (mp === 'drill-combined') {
        const handNum = this.session?.hands;
        const lastHand = (this.combinedPracticeVisit || []).find(h => h.handNum === handNum);
        rev.textContent = formatHandEndReviewCompact(this.roundReview, this.counter, lastHand);
      } else {
        const mistakes = (this.roundReview.decisions || []).filter(d => d.mistake);
        const indexMistakes = mistakes.filter(d => d.indexPlay).length;
        const rc = formatHandRunningCountReviewCompact(
          this.roundReview.runningCountAtHandStart,
          this.counter.runningCount,
        );
        let strat = mistakes.length
          ? `Strategy: ${mistakes.length} suboptimal`
          : 'Strategy: all correct';
        if (indexMistakes) strat += ` (${indexMistakes} index)`;
        rev.textContent = `${rc} · Bet $${this.roundReview.bet} (rec $${this.roundReview.suggested}) · ${strat}`;
      }
    } else rev.classList.add('hidden');

    const quizBtn = document.getElementById('btn-handend-count-quiz');
    if (quizBtn) {
      const showOpt = !!this._handendQuizOptional && !this.help.postHandQuiz();
      quizBtn.classList.toggle('hidden', !showOpt);
    }
    document.getElementById('result-toast').classList.add('hidden');
    requestAnimationFrame(() => this.fitCasinoPlayViewport());
  }
}

// ═══════════════════════════════════════════════════════════════
