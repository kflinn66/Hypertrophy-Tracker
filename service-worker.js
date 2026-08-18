// Bump this on every deploy so phones pick up the new version.
const CACHE_VERSION = 'hypertrack-v6';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './db.js',
  './exercises.js',
  './volume-landmarks.js',
  './plans.js',
  './progression.js',
  './sync.js',
  './app.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  // Deliberately NOT calling skipWaiting() here -- a worker that takes over
  // mid-session would swap the running app's code out from under someone
  // partway through logging a set. Instead this new worker sits in "waiting"
  // until app.js's update banner asks it to activate (see the 'message'
  // listener below), which only happens on an explicit user tap.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Network-first for everything. A stale JS/CSS bundle served from cache
// (or from an upstream CDN cache) while the code has already moved on is
// exactly the kind of confusing bug this is designed to avoid -- so always
// try the network first and only fall back to the cached copy if it's truly
// unreachable (offline, or at the gym with zero signal).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
