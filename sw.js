// Офлайн режим: всичко нужно се пази в телефона след първото отваряне.
// При всяка промяна на файловете смени VERSION, за да получат клиентките новата версия.
const VERSION = 'nnp-1.0.4';
const FONTS = 'nnp-fonts';
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname);
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/ui.js',
  'js/store.js',
  'js/dates.js',
  'js/holidays.js',
  'js/icons.js',
  'js/photos.js',
  'js/config.js',
  'js/cycle-model.js',
  'js/views/calendar.js',
  'js/views/cycle.js',
  'js/views/goals.js',
  'js/views/corner.js',
  'js/views/salon.js',
  'js/views/settings.js',
  'js/views/dreams.js',
  'img/hero.webp',
  'img/q1-winter.webp',
  'img/q2-spring.webp',
  'img/q3-summer.webp',
  'img/q4-autumn.webp',
  'img/cycle.webp',
  'img/books.webp',
  'img/travel.webp',
  'img/gifts.webp',
  'img/dreams.svg',
  'img/salon.webp',
  'img/nnails-logo.webp',
  'img/nanokti-logo.webp',
  'img/nfunds-logo.webp',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // при разработка на компютъра — винаги най-новите файлове
    if (DEV) {
      e.respondWith(fetch(req.url, { cache: 'no-cache' }).catch(() => caches.match(req, { ignoreSearch: true })));
      return;
    }
    if (req.mode === 'navigate') {
      e.respondWith(caches.match('index.html').then((r) => r || fetch(req)));
      return;
    }
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});
