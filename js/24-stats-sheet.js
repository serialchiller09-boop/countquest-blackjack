// §24 Stats sheet — capture delegation close + neutralize transform fight
(function () {
  function getApp() {
    return window.app || window.cqApp || window.__cqApp || null;
  }

  function closeDomOnly() {
    var el = document.getElementById('stats-sidebar');
    var backdrop = document.getElementById('stats-backdrop');
    if (!el) return;
    el.classList.remove('open');
    el.classList.add('is-closed');
    el.classList.remove('translate-x-full');
    el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('stats-open');
    if (backdrop) {
      backdrop.classList.remove('visible');
      backdrop.classList.add('hidden');
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function openDomOnly() {
    var el = document.getElementById('stats-sidebar');
    var backdrop = document.getElementById('stats-backdrop');
    if (!el) return;
    el.classList.add('open');
    el.classList.remove('is-closed');
    el.classList.remove('translate-x-full');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('stats-open');
    if (backdrop) {
      backdrop.classList.add('visible');
      backdrop.classList.remove('hidden');
      backdrop.setAttribute('aria-hidden', 'false');
    }
  }

  function close() {
    var a = getApp();
    if (a && typeof a.toggleStatsSidebar === 'function') {
      try {
        a.toggleStatsSidebar(false);
      } catch (e) {
        closeDomOnly();
      }
    } else {
      closeDomOnly();
    }
  }

  function openAndRender() {
    var a = getApp();
    if (a && typeof a.renderStatsSidebar === 'function') {
      try {
        a.renderStatsSidebar();
      } catch (e) {}
    }
    if (a && typeof a.toggleStatsSidebar === 'function') {
      try {
        a.toggleStatsSidebar(true);
      } catch (e) {
        openDomOnly();
      }
    } else {
      openDomOnly();
    }
    // Force usable open state even if Tailwind class fight remains
    setTimeout(function () {
      var el = document.getElementById('stats-sidebar');
      if (el && !el.classList.contains('open')) openDomOnly();
      else if (el) {
        el.classList.remove('translate-x-full');
        el.classList.remove('is-closed');
      }
    }, 0);
  }

  document.addEventListener(
    'click',
    function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#btn-close-stats')) {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (t.closest('#stats-backdrop')) {
        close();
        return;
      }
      if (t.closest('#btn-menu-stats, #btn-toggle-stats, #btn-options-stats')) {
        // Let app handlers run; ensure open class shortly after (bind may have missed)
        setTimeout(function () {
          var el = document.getElementById('stats-sidebar');
          if (!el) return;
          if (!el.classList.contains('open')) openAndRender();
          else {
            el.classList.remove('translate-x-full');
            el.classList.remove('is-closed');
          }
        }, 0);
      }
    },
    true,
  );

  function patch() {
    if (!window.CountQuestApp || !CountQuestApp.prototype) return false;
    var proto = CountQuestApp.prototype;
    if (proto.__cqStatsSheetPatched) return true;
    proto.__cqStatsSheetPatched = true;
    var orig = proto.toggleStatsSidebar;
    proto.toggleStatsSidebar = function (openFlag) {
      if (typeof orig === 'function') orig.call(this, openFlag);
      var el = document.getElementById('stats-sidebar');
      if (!el) return;
      var wantOpen = !!openFlag;
      el.classList.toggle('open', wantOpen);
      el.classList.toggle('is-closed', !wantOpen);
      // Neutralize Tailwind translate fight — CSS .open / :not(.open) owns transform
      el.classList.remove('translate-x-full');
      el.setAttribute('aria-hidden', String(!wantOpen));
      if (wantOpen && typeof this.renderStatsSidebar === 'function') {
        try {
          this.renderStatsSidebar();
        } catch (e) {}
      }
    };
    return true;
  }

  var n = 0;
  var t = setInterval(function () {
    if (patch() || ++n > 40) clearInterval(t);
  }, 250);
  patch();
})();
