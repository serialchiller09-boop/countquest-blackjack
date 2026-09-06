/* CountQuest: ensure Sounds exists before game engine (iframe / storage hardening) */
(function () {
  function stub() {
    return {
      enabled: true,
      setEnabled: function () {},
      init: function () {},
      play: function () {},
      tone: function () {}
    };
  }
  var s = (typeof Sounds !== 'undefined' && Sounds) || (typeof window !== 'undefined' && window.Sounds);
  if (!s || typeof s.setEnabled !== 'function') {
    s = (typeof createSoundsNoopStub === 'function') ? createSoundsNoopStub() : stub();
  }
  if (typeof window !== 'undefined') window.Sounds = s;
  try { Sounds = s; } catch (_) { /* non-writable binding */ }
})();
