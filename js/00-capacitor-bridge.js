// Capacitor native shell — detect WebView, skip PWA SW, apply safe-area class.
(function () {
  window.__CQ_DEV_MODE = !!(window.__CQ_DEV_MODE || /(?:^|[?&])dev=1(?:&|$)/.test(location.search));
  if (window.__CQ_DEV_MODE) document.documentElement.classList.add('cq-dev');
  function boot() {
    const cap = window.Capacitor;
    const native = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    window.__CQ_NATIVE = native;
    if (!native) return;
    const platform = cap.getPlatform?.() || 'native';
    document.documentElement.classList.add('cq-native', `cq-native-${platform}`);
    const stamp = document.getElementById('cq-build-stamp');
    if (stamp) stamp.classList.remove('hidden');
    const plugins = cap.Plugins || {};
    plugins.StatusBar?.setStyle?.({ style: 'DARK' }).catch(() => {});
    plugins.StatusBar?.setBackgroundColor?.({ color: '#0a1612' }).catch(() => {});
    plugins.SplashScreen?.hide?.().catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
