/* CountQuest PWA service worker — cache app shell for offline repeat visits. */
const CACHE_VERSION = 'cq-pwa-v26';
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tailwind.css',
  './css/app.css',
  './css/casino-felt-table.css',
  './css/play-store-v1.css',
  './css/cq-modern.css',
  './css/cq-v60-play.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/00-capacitor-bridge.js',
  './js/01-constants.js',
  './js/02-core-types.js',
  './js/03-counting.js',
  './js/04-strategy.js',
  './js/05-help-system.js',
  './js/06-stats-storage.js',
  './js/06b-validation.js',
  './js/07-game-engine.js',
  './js/08-tutorial.js',
  './js/09-tests.js',
  './js/10-dealer-engine.js',
  './js/11-first-run.js',
  './js/12-tester-qa.js',
  './js/13-new-player-lobby.js',
  './js/14-clubs-spin-ui.js',
  './js/15-visual.js',
  './js/16-casino-theme.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isAppShell = /\.(html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');
  event.respondWith(
    (isAppShell ? fetch(request) : caches.match(request))
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        }
        return caches.match(request).then((cached) => cached || response);
      })
      .catch(() => caches.match(request).then((cached) => cached || new Response('Offline', { status: 503 }))),
  );
});
