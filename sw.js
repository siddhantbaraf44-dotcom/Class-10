/* Service Worker for the Q&A Student app.
 * Strategy:
 *   - App shell (the project's own HTML/CSS/JS/icons): cache-first.
 *   - Firebase & 3rd-party (gstatic/googleapis/firebaseio/firebaseapp): network-only.
 *   - Navigations: network-first with cached fallback so users still get a page offline.
 */

const CACHE_VERSION = 'qa-student-v1';
const APP_SHELL = [
  './',
  './index.html',
  './subjects.html',
  './chapters.html',
  './questions.html',
  './answer.html',
  './books.html',
  './books-admin.html',
  './styles.css',
  './shared.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-167.png',
  './icons/icon-152.png',
  './icons/icon-120.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL).catch(() => {/* ignore individual failures */}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isThirdParty(url) {
  const h = url.hostname;
  return (
    h.endsWith('gstatic.com') ||
    h.endsWith('googleapis.com') ||
    h.endsWith('firebaseio.com') ||
    h.endsWith('firebaseapp.com') ||
    h.endsWith('firebasestorage.app') ||
    h.includes('firebase')
  );
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Always go to network for third-party / Firebase requests.
  if (url.origin !== self.location.origin || isThirdParty(url)) {
    return; // browser default
  }

  // For navigation requests, try network first, fall back to cached shell.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // For same-origin static assets: cache-first.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
