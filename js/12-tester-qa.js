// §12 TESTER QA — dead-button guards (Play Store v1)
(function () {
  if (window.__CQ_TESTER_QA_BOOTED) return;
  window.__CQ_TESTER_QA_BOOTED = true;

  function patch() {
    if (typeof CountQuestApp === 'undefined') return false;
    const proto = CountQuestApp.prototype;
    if (proto.__cqTesterQaPatched) return true;
    proto.__cqTesterQaPatched = true;

    const origMini = proto.openLobbyMinigame;
    proto.openLobbyMinigame = function (id) {
      origMini.call(this, id);
      const action = document.getElementById('btn-lobby-minigame-action');
      if (action) action.disabled = false;
      const close = document.getElementById('btn-lobby-minigame-close');
      if (close) close.disabled = false;
    };

    return true;
  }

  function boot() {
    if (patch()) return;
    window.addEventListener('load', patch);
    document.addEventListener('DOMContentLoaded', patch);
  }
  boot();
})();
