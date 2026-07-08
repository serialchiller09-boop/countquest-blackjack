// Capacitor native shell — detect WebView, skip PWA SW, apply safe-area class.
(function () {
  function boot() {
    const cap = window.Capacitor;
    const native = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
    window.__CQ_NATIVE = native;
    if (!native) return;
    const platform = cap.getPlatform?.() || 'native';
    document.documentElement.classList.add('cq-native', `cq-native-${platform}`);
    const plugins = cap.Plugins || {};
    plugins.StatusBar?.setStyle?.({ style: 'DARK' }).catch(() => {});
    plugins.StatusBar?.setBackgroundColor?.({ color: '#0a1612' }).catch(() => {});
    plugins.SplashScreen?.hide?.().catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();