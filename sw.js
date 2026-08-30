const CACHE = 'h2o8-v2';
// './index.html' is deliberately absent: Cloudflare 307-redirects it to './',
// and a redirected response stored here poisons every later navigation.
const SHELL = ['./', './app.js', './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png'];

// WebKit refuses to answer a navigation with a response that was redirected.
// Rebuild such a response as a plain one so './index.html' — still the start
// URL of any Home Screen icon installed before this fix — keeps working.
const unredirect = res => res.redirected
  ? res.blob().then(b => new Response(b,
      { status: res.status, statusText: res.statusText, headers: res.headers }))
  : res;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(unredirect).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./')))
  );
});
